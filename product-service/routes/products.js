const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Product = require("../models/Product");

// GET /products - List all products
router.get("/", async (req, res) => {
  try {
    const { category, minPrice, maxPrice } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// GET /products/:id - Get single product by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `Product with id '${id}' not found (invalid ID format)`,
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        error: "Not Found",
        message: `Product with id '${id}' not found`,
      });
    }

    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// POST /products - Create a new product
router.post("/", async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        error: "Bad Request",
        message: "name and price are required fields",
      });
    }

    const product = new Product({
      name,
      description: description || "",
      price: Number(price),
      category: category || "Academic Supplies",
      stock: stock !== undefined ? Number(stock) : 10,
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Validation Error", message: err.message });
    }
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// PUT /products/:id - Update product by ID
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `Product with id '${id}' not found`,
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct) {
      return res.status(404).json({
        error: "Not Found",
        message: `Product with id '${id}' not found`,
      });
    }

    res.status(200).json(updatedProduct);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Validation Error", message: err.message });
    }
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// DELETE /products/:id - Delete product by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `Product with id '${id}' not found`,
      });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({
        error: "Not Found",
        message: `Product with id '${id}' not found`,
      });
    }

    res.status(200).json({
      message: `Product with id '${id}' deleted successfully`,
      deletedProduct,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

module.exports = router;
