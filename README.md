# Lab 7 — API Gateway, Service Discovery & Cloud Deployment

**CampusConnect Microservices** • Web Services & SOA Laboratory  
**Student:** Harsh Patel • **Roll No:** 202512093

---

## 1. Objective

Lab 6 decomposed the backend into three independently runnable microservices — **User**, **Product**, and **Order** — communicating directly over a Docker network. Lab 7 makes the API Gateway concept **real**:

1. Build an actual **API Gateway** as the single entry point for all clients.
2. Make the gateway's knowledge of service locations **configurable** (config-based service discovery).
3. **Deploy** the containerized system to the cloud so it is reachable over the internet.

**Full-stack flow:**

```
Client / Postman → API Gateway (public) → Service Registry / Config → User / Product / Order Services (containers) → MongoDB Atlas
```

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                    │
│                                                                      │
│   ┌──────────────┐                                                   │
│   │  Client /    │                                                   │
│   │  Postman     │                                                   │
│   └──────┬───────┘                                                   │
│          │ HTTP requests to single public URL                        │
│          ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │              API GATEWAY  (port 3000)                        │   │
│   │  • Reverse proxy routing (/users, /products, /orders)        │   │
│   │  • Request logging (morgan)                                  │   │
│   │  • GET /health endpoint                                     │   │
│   │  • Centralized 502/503 error handling                        │   │
│   │  • Reads service URLs from env vars (service discovery)      │   │
│   └──────┬──────────────┬──────────────┬─────────────────────────┘   │
│          │              │              │                              │
│  ┌───────┴───────┐┌─────┴──────┐┌──────┴──────┐                     │
│  │  DOCKER NETWORK (campus-network) — internal only  │              │
│  │               ││            ││             │                      │
│  │  ┌────────────┐│┌───────────┐│┌────────────┐                     │
│  │  │   User     │││  Product  │││   Order    │                     │
│  │  │  Service   │││  Service  │││  Service   │                     │
│  │  │  :3001     │││  :3002    │││  :3003     │                     │
│  │  └─────┬──────┘│└─────┬─────┘│└──┬───┬─────┘                     │
│  │        │       │      │      │   │   │                            │
│  │  ┌─────┴──┐    │┌─────┴──┐   │   │   │                           │
│  │  │user-db │    ││prod-db │   │   │   │                           │
│  │  │MongoDB │    ││MongoDB │   │   │   │                           │
│  │  └────────┘    │└────────┘   │   │   │                           │
│  │                │             │   │   │                            │
│  │                │  ┌──────────┘   │   │                            │
│  │                │  │  ┌───────────┘   │                            │
│  │                │  │  │  ┌────────────┘                            │
│  │                │  │  │  │                                         │
│  │                │  │  ▼  ▼                                         │
│  │                │  │ ┌────────┐                                    │
│  │                │  │ │ord-db  │                                    │
│  │                │  │ │MongoDB │                                    │
│  │                │  │ └────────┘                                    │
│  └────────────────┘└─┘                                               │
│                                                                      │
│             ┌──────────────────────────┐                             │
│             │   MongoDB Atlas (Cloud)  │  ← used in cloud deployment │
│             │   Persistent storage     │                             │
│             └──────────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Key architectural constraint:** Only the API Gateway's port (3000) is exposed externally. The three microservices are accessible **only** from within the Docker network — clients cannot call them directly.

---

## 3. Project Structure

```
lab7/
├── api-gateway/                 # NEW — Lab 7
│   ├── config/
│   │   └── serviceRegistry.js   # Config-based service discovery
│   ├── server.js                # Gateway: proxy, logging, /health, error handling
│   ├── Dockerfile
│   ├── package.json
│   ├── .dockerignore
│   └── .env.example
├── user-service/                # From Lab 6 — unchanged
│   ├── config/db.js
│   ├── models/User.js
│   ├── routes/users.js
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
├── product-service/             # From Lab 6 — unchanged
│   ├── config/db.js
│   ├── models/Product.js
│   ├── routes/products.js
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
├── order-service/               # From Lab 6 — unchanged
│   ├── config/db.js
│   ├── models/Order.js
│   ├── routes/orders.js
│   ├── services/
│   │   ├── userService.js
│   │   └── productService.js
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
├── compose.yaml                 # Updated — gateway added, services internal-only
├── .env.example                 # Environment template
├── Lab7_API_Gateway.postman_collection.json
└── README.md                    # This file
```

---

## 4. Gateway Endpoints (Routing Table)

| Gateway Path | Routed To | Methods | Example |
|---|---|---|---|
| `/users`, `/users/:id` | User Service (:3001) | GET, POST, PUT, DELETE | `GET /users/64a...` |
| `/products`, `/products/:id` | Product Service (:3002) | GET, POST, PUT, DELETE | `POST /products` |
| `/orders`, `/orders/:id` | Order Service (:3003) | GET, POST | `POST /orders` |
| `/health` | Gateway itself | GET | `GET /health` |

---

## 5. Discussion: Why Use an API Gateway?

Instead of letting clients call each microservice directly (requiring them to know every service's URL and port), the API Gateway provides:

1. **Single entry point** — Clients interact with one URL (`http://gateway:3000`). They don't need to know that User Service runs on port 3001, Product on 3002, or Order on 3003. If we add new services or change ports, clients don't care.

2. **Internal structure is hidden** — The three microservices are only accessible within the Docker network. External clients have no idea how many services exist or where they run. This is a security and encapsulation win.

3. **Centralized cross-cutting concerns** — Instead of duplicating logging, error handling, CORS, and rate limiting across every service, the gateway handles them once:
   - **Request logging:** Every incoming request is logged with method, path, target service, and response status (via morgan).
   - **Error handling:** If a service is unreachable, the gateway returns a clean 502/503 JSON response instead of the client seeing a cryptic connection error or timeout.
   - **CORS:** Configured once at the gateway level.

4. **Simplified client code** — Frontend or mobile apps only need to know one base URL. API versioning, authentication, and routing logic stay at the gateway layer.

---

## 6. Discussion: Static vs Dynamic Service Discovery

### Our Approach — Static / Configuration-Based

The gateway reads service URLs from environment variables at startup:

```
USER_SERVICE_URL=http://user-service:3001
PRODUCT_SERVICE_URL=http://product-service:3002
ORDER_SERVICE_URL=http://order-service:3003
```

These are defined in `compose.yaml` (or a `.env` file). To change a service's location, we update the environment variable and restart the gateway — **no code changes required**.

### Dynamic Service Discovery (Consul, Eureka, Kubernetes DNS)

A dynamic registry adds capabilities that a static config file **cannot** provide:

| Capability | Static Config | Dynamic Registry |
|---|---|---|
| **Health-aware routing** | ❌ No — gateway proxies to configured URL even if service is down | ✅ Yes — unhealthy instances are automatically removed from the registry |
| **Auto-registration** | ❌ No — new services must be manually added to config | ✅ Yes — services register themselves on startup |
| **Multiple instances / Load balancing** | ❌ No — one URL per service | ✅ Yes — registry tracks all instances, gateway picks one (round-robin, etc.) |
| **Real-time updates** | ❌ No — requires gateway restart to pick up changes | ✅ Yes — registry pushes changes or gateway polls for updates |
| **Service metadata** | ❌ Limited — just a URL | ✅ Rich — version, tags, datacenter, health status |

**Verdict:** For this lab's scale (3 fixed services), static config is perfectly adequate and simpler to operate. Dynamic discovery becomes essential when services scale to many instances, auto-scale, or frequently change locations — typical in production Kubernetes or cloud-native environments.

---

## 7. How to Run Locally

### Prerequisites

- Docker & Docker Compose installed
- Ports 3000 available (gateway)

### Steps

```bash
# 1. Navigate to lab7 directory
cd lab7

# 2. Build and start all services
docker compose up --build -d

# 3. Verify gateway is running
curl http://localhost:3000/health

# 4. Test routing through gateway
curl http://localhost:3000/users
curl http://localhost:3000/products
curl http://localhost:3000/orders
```

### Test the Full Flow in Postman

1. Import `Lab7_API_Gateway.postman_collection.json` into Postman.
2. Ensure `gateway_url` variable is set to `http://localhost:3000`.
3. Run the collection in order — IDs are auto-captured.

### Test 502/503 Error Handling

```bash
# Stop user-service to simulate it being unreachable
docker compose stop user-service

# Now call /users through the gateway — should get 502 or 503
curl http://localhost:3000/users
# Expected: {"error":"Service Unavailable","message":"user-service is currently unreachable..."}

# Restart user-service
docker compose start user-service
```

### Prove Config-Based Discovery Works (No Code Change)

```bash
# 1. Stop everything
docker compose down

# 2. Change user-service to run on port 4001 in compose.yaml:
#    - Change user-service PORT env to 4001
#    - Change user-service expose to 4001
#    - Change api-gateway USER_SERVICE_URL to http://user-service:4001

# 3. Rebuild and start
docker compose up --build -d

# 4. Gateway routes /users correctly to the new port — no code was changed
curl http://localhost:3000/users
```

---

## 8. Cloud Deployment

### Platform: Render (Free Tier)

> **Note:** Replace with your actual platform and URLs.

### Steps

1. **Push code to GitHub** — Ensure the `lab7/` directory is in your repository.

2. **Create services on Render:**
   - **user-service** → Web Service, Docker runtime, internal only
   - **product-service** → Web Service, Docker runtime, internal only
   - **order-service** → Web Service, Docker runtime, internal only
   - **api-gateway** → Web Service, Docker runtime, **public**

3. **Set environment variables** on each service:
   - All services: `MONGO_URI` = your MongoDB Atlas connection string
   - API Gateway: `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL` = internal Render URLs

4. **MongoDB Atlas:**
   - Ensure your Atlas cluster allows connections from Render's IP range (or `0.0.0.0/0` for testing).
   - Use separate databases per service: `user_service_db`, `product_service_db`, `order_service_db`.

5. **Verify deployment:**
   ```
   curl https://YOUR-GATEWAY.onrender.com/health
   ```

### Public Gateway URL

```
https://YOUR-GATEWAY.onrender.com
```

> ⚠️ Replace with your actual deployed URL after deploying.

### Re-run Postman Tests on Cloud

1. In the Postman collection, change `gateway_url` to your public gateway URL.
2. Run all tests — they should pass the same as localhost.

---

## 9. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `502 Bad Gateway` on all routes | Services haven't started yet | Wait 10-15s after `docker compose up`, then retry |
| `503 Service Unavailable` | Target service is down | Check `docker compose logs <service-name>` |
| `ECONNREFUSED` in gateway logs | Service URL is wrong or service crashed | Verify `*_SERVICE_URL` env vars match actual service hostnames/ports |
| MongoDB connection fails | Wrong `MONGO_URI` | Check the URI in compose.yaml or .env; ensure MongoDB container is running |
| Gateway hangs instead of 502 | Proxy timeout too high | Check `proxyTimeout` in `server.js` (currently 5000ms) |
| Cloud: services can't find each other | Wrong internal URLs on cloud platform | Use the platform's internal service URLs (not localhost) |
| Cloud: MongoDB Atlas rejects connection | IP not whitelisted | Add cloud platform's IP range to Atlas Network Access |

---

## 10. Reflection

In Lab 6, each microservice was individually exposed on its own port (3001, 3002, 3003), and any client or tool (like Postman) had to know the exact address of each service. Lab 7 fundamentally changes this by introducing the API Gateway as a **single front door** — clients now only need to know one URL. This simplifies client-side logic, hides internal service topology, and centralizes cross-cutting concerns like logging and error handling in one place. The config-based service discovery means we can re-route traffic by changing an environment variable instead of modifying code — a small but meaningful step toward operational flexibility. Deploying to the cloud transforms the system from a localhost-only development setup into something accessible over the internet, making it feel like a real production system. The combination of gateway + containerization + cloud deployment demonstrates how microservices are actually operated in practice: behind a reverse proxy, inside a private network, with only one controlled entry point exposed to the outside world.

---

## 11. Technologies Used

| Technology | Purpose |
|---|---|
| **Node.js 20** | Runtime for all services |
| **Express.js 4** | Web framework |
| **http-proxy-middleware** | Reverse proxy for API Gateway |
| **morgan** | HTTP request logging |
| **Mongoose** | MongoDB ODM |
| **MongoDB 6** | Database (local via Docker) |
| **MongoDB Atlas** | Cloud database (for deployment) |
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Render / Railway** | Cloud deployment platform |

---

## 12. Final Checklist

| API Gateway | Service Discovery | Cloud Deployment | Evidence |
|---|---|---|---|
| ✅ api-gateway service created | ✅ Service URLs in env vars/config | ⬜ Cloud platform chosen | ✅ Postman: gateway routes |
| ✅ Routes to User/Product/Order | ✅ No hard-coded URLs in route code | ⬜ Gateway + services deployed | ✅ Postman: /health check |
| ✅ GET /health implemented | ✅ Config change proven without code change | ⬜ Env vars set for cloud | ✅ 502/503 test evidence |
| ✅ Request logging added | ✅ Static vs dynamic discussed in README | ⬜ Public gateway URL reachable | ⬜ Cloud deployment screenshots |
| ✅ 502/503 on unreachable service | — | ⬜ Postman re-tested on public URL | ✅ Updated README.md |

> ⬜ items require manual cloud deployment — see Section 8.

---

*Lab 7 — Web Services & SOA Laboratory*
