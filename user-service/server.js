require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const userRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || process.env.USER_SERVICE_PORT || 3001;

// Connect to dedicated User Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[User Service] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "UP",
    service: "user-service",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// REST Routes
app.use("/users", userRoutes);

// Root informational endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    service: "CampusConnect User Service",
    version: "1.0.0",
    endpoints: {
      getAllUsers: "GET /users",
      getUserById: "GET /users/:id",
      createUser: "POST /users",
      updateUser: "PUT /users/:id",
      deleteUser: "DELETE /users/:id",
      healthCheck: "GET /health",
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found", message: "Endpoint not found on User Service" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[User Service Error]:", err.stack || err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred in User Service",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [User Service] listening on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
});
