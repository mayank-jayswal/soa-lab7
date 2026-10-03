require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const productRoutes = require("./routes/products");

const app = express();
const PORT = process.env.PORT || process.env.PRODUCT_SERVICE_PORT || 3002;

// Connect to dedicated Product Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[Product Service] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "UP",
    service: "product-service",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// REST Routes
app.use("/products", productRoutes);

// Root informational endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    service: "CampusConnect Product Service",
    version: "1.0.0",
    endpoints: {
      getAllProducts: "GET /products",
      getProductById: "GET /products/:id",
      createProduct: "POST /products",
      updateProduct: "PUT /products/:id",
      deleteProduct: "DELETE /products/:id",
      healthCheck: "GET /health",
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found", message: "Endpoint not found on Product Service" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[Product Service Error]:", err.stack || err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred in Product Service",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [Product Service] listening on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
});
