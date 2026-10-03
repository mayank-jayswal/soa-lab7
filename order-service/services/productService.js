const getProductById = async (productId) => {
  const baseUrl = process.env.PRODUCT_SERVICE_URL || "http://product-service:3002";
  const url = `${baseUrl.replace(/\/+$/, "")}/products/${productId}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      const err = new Error(`Product with ID '${productId}' not found in Product Service`);
      err.statusCode = 404;
      err.service = "product-service";
      throw err;
    }

    if (!response.ok) {
      const err = new Error(
        `Product Service returned status ${response.status} for Product ID '${productId}'`
      );
      err.statusCode = response.status >= 500 ? 503 : response.status;
      err.service = "product-service";
      throw err;
    }

    const productData = await response.json();
    return productData;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    // Handle connection failures, timeouts, ECONNREFUSED
    const err = new Error(
      `Product Service is currently unavailable at ${baseUrl}: ${error.message}`
    );
    err.statusCode = 503;
    err.service = "product-service";
    err.originalError = error.message;
    throw err;
  }
};

module.exports = { getProductById };
