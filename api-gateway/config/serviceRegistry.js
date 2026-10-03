/**
 * Service Registry - Configuration-Based Service Discovery
 *
 * This module externalizes all service URLs into environment variables,
 * acting as a lightweight, static service registry. The gateway reads
 * this configuration at startup and uses it to build its routing table.
 *
 * To change a service's location, update only the environment variable
 * (e.g. in .env or docker-compose.yml) — no code change required.
 */

const serviceRegistry = {
  userService: {
    name: "user-service",
    url: process.env.USER_SERVICE_URL || "http://user-service:3001",
    pathPrefix: "/users",
  },
  productService: {
    name: "product-service",
    url: process.env.PRODUCT_SERVICE_URL || "http://product-service:3002",
    pathPrefix: "/products",
  },
  orderService: {
    name: "order-service",
    url: process.env.ORDER_SERVICE_URL || "http://order-service:3003",
    pathPrefix: "/orders",
  },
};

/**
 * Returns an array of route definitions for the proxy middleware.
 * Each entry contains { pathPrefix, target, serviceName }.
 */
const getRoutes = () =>
  Object.values(serviceRegistry).map((svc) => ({
    pathPrefix: svc.pathPrefix,
    target: svc.url,
    serviceName: svc.name,
  }));

/**
 * Pretty-prints the current service registry to the console.
 */
const printRegistry = () => {
  console.log("\n📋 Service Registry (Configuration-Based Discovery):");
  console.log("─".repeat(60));
  Object.values(serviceRegistry).forEach((svc) => {
    console.log(`  ${svc.pathPrefix.padEnd(12)} → ${svc.url} (${svc.name})`);
  });
  console.log("─".repeat(60));
};

module.exports = { serviceRegistry, getRoutes, printRegistry };
