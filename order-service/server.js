require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const orderRoutes = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || process.env.ORDER_SERVICE_PORT || 3003;

// Connect to dedicated Order Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[Order Service] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "UP",
    service: "order-service",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// REST Routes
app.use("/orders", orderRoutes);

// Root informational endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    service: "CampusConnect Order Service",
    version: "1.0.0",
    dependencies: {
      userServiceUrl: process.env.USER_SERVICE_URL || "http://user-service:3001",
      productServiceUrl: process.env.PRODUCT_SERVICE_URL || "http://product-service:3002",
    },
    endpoints: {
      getAllOrders: "GET /orders",
      getOrderById: "GET /orders/:id",
      createOrder: "POST /orders",
      healthCheck: "GET /health",
    },
  });
});

// 404 route handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found", message: "Endpoint not found on Order Service" });
});

// Centralized Inter-Service Error Handling Middleware (Section 10 & 15 requirement)
app.use((err, _req, res, _next) => {
  console.error("[Order Service Error Caught]:", err.message);

  // Controlled 503 Service Unavailable when dependency is down
  if (err.statusCode === 503) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: err.message,
      failedDependency: err.service || "external-service",
      retryable: true,
      timestamp: new Date().toISOString(),
    });
  }

  // 404 Not Found when referenced user or product does not exist
  if (err.statusCode === 404) {
    return res.status(404).json({
      error: "Not Found",
      message: err.message,
      service: err.service || "order-service",
    });
  }

  // 400 Bad Request
  if (err.statusCode === 400 || err.name === "ValidationError") {
    return res.status(400).json({
      error: "Bad Request",
      message: err.message,
    });
  }

  // Unhandled / 500 errors
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred in Order Service",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [Order Service] listening on port ${PORT}`);
  console.log(`🔗 User Service Target:    ${process.env.USER_SERVICE_URL || "http://user-service:3001"}`);
  console.log(`🔗 Product Service Target: ${process.env.PRODUCT_SERVICE_URL || "http://product-service:3002"}`);
  console.log(`📡 Health Check:           http://localhost:${PORT}/health`);
});
