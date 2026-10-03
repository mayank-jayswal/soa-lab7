const getUserById = async (userId) => {
  const baseUrl = process.env.USER_SERVICE_URL || "http://user-service:3001";
  const url = `${baseUrl.replace(/\/+$/, "")}/users/${userId}`;

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
      const err = new Error(`User with ID '${userId}' not found in User Service`);
      err.statusCode = 404;
      err.service = "user-service";
      throw err;
    }

    if (!response.ok) {
      const err = new Error(
        `User Service returned status ${response.status} for User ID '${userId}'`
      );
      err.statusCode = response.status >= 500 ? 503 : response.status;
      err.service = "user-service";
      throw err;
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    // Handle connection failures, timeouts, ECONNREFUSED
    const err = new Error(
      `User Service is currently unavailable at ${baseUrl}: ${error.message}`
    );
    err.statusCode = 503;
    err.service = "user-service";
    err.originalError = error.message;
    throw err;
  }
};

module.exports = { getUserById };
