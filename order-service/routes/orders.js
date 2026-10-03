const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Order = require("../models/Order");
const { getUserById } = require("../services/userService");
const { getProductById } = require("../services/productService");

// GET /orders - List all orders
router.get("/", async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id - Get single order by ID
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `Order with id '${id}' not found (invalid ID format)`,
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        error: "Not Found",
        message: `Order with id '${id}' not found`,
      });
    }

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
});

// POST /orders - Create order (Demonstrates Inter-Service Communication)
router.post("/", async (req, res, next) => {
  try {
    const { userId, productId, quantity } = req.body;

    // 1. Validate required fields
    if (!userId || !productId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId and productId are required fields",
      });
    }

    const qty = quantity !== undefined ? Number(quantity) : 1;
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        error: "Bad Request",
        message: "quantity must be a positive number greater than or equal to 1",
      });
    }

    // 2. Synchronous inter-service call to User Service
    //    Throws 404 if user not found, 503 if user-service is down
    console.log(`[Order Service] Verifying user '${userId}' with User Service...`);
    const user = await getUserById(userId);

    // 3. Synchronous inter-service call to Product Service
    //    Throws 404 if product not found, 503 if product-service is down
    console.log(`[Order Service] Verifying product '${productId}' with Product Service...`);
    const product = await getProductById(productId);

    // 4. Validate stock availability
    if (product.stock !== undefined && product.stock < qty) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Insufficient stock for '${product.name}'. Available: ${product.stock}, Requested: ${qty}`,
      });
    }

    // 5. Calculate pricing
    const unitPrice = Number(product.price);
    const totalPrice = Number((unitPrice * qty).toFixed(2));

    // 6. Create order with reference IDs and snapshot metadata
    const order = new Order({
      userId: user.id || user._id,
      productId: product.id || product._id,
      quantity: qty,
      unitPrice,
      totalPrice,
      status: "CONFIRMED",
      userDetails: {
        name: user.name,
        email: user.email,
        department: user.department || "N/A",
      },
      productDetails: {
        name: product.name,
        category: product.category || "General",
      },
    });

    await order.save();
    console.log(`[Order Service] ✅ Order created successfully with ID: ${order._id}`);

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (err) {
    // Forward to centralized resilience error handler
    next(err);
  }
});

module.exports = router;
