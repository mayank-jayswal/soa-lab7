require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { getRoutes, printRegistry } = require("./config/serviceRegistry");

const app = express();
const PORT = process.env.PORT || process.env.GATEWAY_PORT || 3000;

// =========================================================================
// Middlewares
// =========================================================================
app.use(cors());

// Request logging — logs method, path, status, and response time
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: (message) =>
        console.log(`[API Gateway] ${message.trim()}`),
    },
  })
);

// =========================================================================
// Gateway Health Check (no proxying — handled by gateway itself)
// =========================================================================
app.get("/health", (_req, res) => {
  const routes = getRoutes();
  res.status(200).json({
    status: "UP",
    service: "api-gateway",
    port: PORT,
    timestamp: new Date().toISOString(),
    registeredServices: routes.map((r) => ({
      path: r.pathPrefix,
      target: r.target,
      service: r.serviceName,
    })),
  });
});

// =========================================================================
// Reverse-Proxy Routes — built dynamically from the service registry
// =========================================================================
const routes = getRoutes();

routes.forEach(({ pathPrefix, target, serviceName }) => {
  const proxyMiddleware = createProxyMiddleware({
    target,
    changeOrigin: true,
    // Use pathFilter so the proxy only handles matching paths
    // but the full original path (e.g. /users/:id) is forwarded intact
    pathFilter: pathPrefix,
    // Timeout for connecting to the target service
    proxyTimeout: 5000,
    timeout: 5000,

    on: {
      // Log each proxied request
      proxyReq: (proxyReq, req, _res) => {
        console.log(
          `[API Gateway] ➡  Proxying ${req.method} ${req.originalUrl} → ${serviceName} (${target})`
        );
      },

      // Log successful proxy responses
      proxyRes: (proxyRes, req, _res) => {
        console.log(
          `[API Gateway] ⬅  ${serviceName} responded ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`
        );
      },

      // Centralized error handling: 502 Bad Gateway when service is unreachable
      error: (err, req, res) => {
        console.error(
          `[API Gateway] ❌ Error proxying to ${serviceName} (${target}): ${err.message}`
        );

        // Guard: if headers already sent, we can't send another response
        if (res.headersSent) return;

        const statusCode =
          err.code === "ECONNREFUSED" || err.code === "ECONNRESET"
            ? 503
            : 502;

        res.status(statusCode).json({
          error: statusCode === 503 ? "Service Unavailable" : "Bad Gateway",
          message: `${serviceName} is currently unreachable at ${target}`,
          gateway: "api-gateway",
          targetService: serviceName,
          targetUrl: target,
          timestamp: new Date().toISOString(),
        });
      },
    },
  });

  // Mount at root "/" so the full path is preserved when forwarding
  app.use(proxyMiddleware);
});

// =========================================================================
// Fallback 404 — no matching proxy route
// =========================================================================
app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "No matching gateway route. Available prefixes: /users, /products, /orders",
    gateway: "api-gateway",
  });
});

// =========================================================================
// Global Error Handler
// =========================================================================
app.use((err, _req, res, _next) => {
  console.error("[API Gateway] Unhandled Error:", err.stack || err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred in the API Gateway",
    gateway: "api-gateway",
  });
});

// =========================================================================
// Start Gateway
// =========================================================================
app.listen(PORT, () => {
  console.log(`\n🚀 [API Gateway] listening on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  printRegistry();
  console.log(
    "\n⚡ All client requests should go through the gateway — services are internal only.\n"
  );
});
