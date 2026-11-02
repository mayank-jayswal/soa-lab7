# Lab 8 — Kubernetes, CI/CD & Monitoring

**CampusConnect Microservices** • Web Services & SOA Laboratory  
**Student:** Mayank Jayswal • **Roll No:** 202512093

> **Lab Continuity Note**: This repository contains both Lab 7 and Lab 8 implementations. For Lab 7 documentation, see [LAB7_README.md](./LAB7_README.md).

---

## 1. Objective & Lab Overview

Building directly upon the **Lab 7** architecture (API Gateway + User + Product + Order microservices communicating over internal networks to MongoDB Atlas), **Lab 8** completes the DevOps lifecycle:

1. **Kubernetes Orchestration**:
   - Deploy API Gateway, User Service, Product Service, and Order Service into a dedicated `lab8` namespace.
   - Externalize configuration via Kubernetes **ConfigMap** and database credentials via **Secrets**.
   - Configure **Liveness** and **Readiness** health probes on `/health` for robust pod lifecycle management.
   - Demonstrate Kubernetes **Service Discovery** via internal DNS names (e.g. `http://user-service:3001`).
   - Demonstrate horizontal **Scaling** (`kubectl scale`) and automatic **Self-Healing** when pods are killed.
2. **GitHub Actions CI/CD Pipeline**:
   - Automate checkout, dependency installation, testing (`npm test`), and versioned Docker image creation (`app:${{ github.sha }}`) triggered on pushes and pull requests.
   - Tag and push images to GitHub Container Registry (GHCR) or Docker Hub.
3. **Observability & Monitoring (Prometheus & Grafana)**:
   - Expose application performance metrics via `GET /metrics` (`prom-client`).
   - Scrape gateway metrics with Prometheus and query key indicators (`up`, `rate(http_requests_total[5m])`).
   - Build a visual Grafana dashboard monitoring availability, request rates, error codes, and latency under generated traffic.

---

## 2. End-to-End System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   INTERNET                                       │
│                                                                                  │
│   ┌────────────────┐                                                             │
│   │ Client /       │                                                             │
│   │ Postman        │                                                             │
│   └───────┬────────┘                                                             │
│           │ HTTP (NodePort 30080 / Gateway:3000)                                 │
│           ▼                                                                      │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                     KUBERNETES NAMESPACE: lab8                           │   │
│   │                                                                          │   │
│   │   ┌──────────────────────────────────────────────────────────────────┐   │   │
│   │   │                  API GATEWAY SERVICE (NodePort 30080)            │   │   │
│   │   │   • Routes: /users, /products, /orders                           │   │   │
│   │   │   • Probes: Liveness & Readiness (/health)                       │   │   │
│   │   │   • Metrics Exporter (/metrics via prom-client)                  │   │   │
│   │   │   • Config-based Service Discovery via app-config ConfigMap      │   │   │
│   │   └───────────────┬───────────────────┬───────────────────┬──────────┘   │   │
│   │                   │                   │                   │              │   │
│   │     ClusterIP:3001│      ClusterIP:3002│      ClusterIP:3003│              │   │
│   │                   ▼                   ▼                   ▼              │   │
│   │        ┌──────────────────┐┌──────────────────┐┌──────────────────┐      │   │
│   │        │   User Service   ││  Product Service ││  Order Service   │      │   │
│   │        │ (Scaled x3 Pods) ││    (1 Replica)   ││    (1 Replica)   │      │   │
│   │        │  Probe: /health  ││  Probe: /health  ││  Probe: /health  │      │   │
│   │        └─────────┬────────┘└─────────┬────────┘└────┬────────┬────┘      │   │
│   │                  │                   │              │        │           │   │
│   │                  │                   │              │        │           │   │
│   │                  │                   └──────────────┼────────┘           │   │
│   │                  │         Inter-Service HTTP Calls │                    │   │
│   │                  └──────────────────────────────────┘                    │   │
│   │                                                                          │   │
│   │   ┌──────────────────────────────────┐ ┌─────────────────────────────┐   │   │
│   │   │  Prometheus Server (NodePort:    │ │  Grafana Dashboard (NodePort│   │   │
│   │   │  30090) — Scrapes /metrics       │◄┼──30300) — Visualizations    │   │   │
│   │   └──────────────────────────────────┘ └─────────────────────────────┘   │   │
│   └───────────────────────────────────┬──────────────────────────────────────┘   │
│                                       │ External TLS                             │
│                                       ▼                                          │
│                    ┌─────────────────────────────────────┐                       │
│                    │     MongoDB Atlas (Cloud Database)  │                       │
│                    │   Persistent Multi-Tenant Storage   │                       │
│                    └─────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Directory Structure

```
lab8/
├── .github/
│   └── workflows/
│       └── ci.yml                        # GitHub Actions CI/CD Pipeline
├── k8s/                                  # Kubernetes Manifests
│   ├── namespace.yaml                    # Namespace declaration: 'lab8'
│   ├── configmap.yaml                    # Non-sensitive configuration (Service URLs)
│   ├── secret.yaml                       # Sensitive MongoDB connection strings
│   ├── gateway-deployment.yaml           # API Gateway Deployment with health probes
│   ├── gateway-service.yaml              # API Gateway NodePort Service (30080)
│   ├── user-deployment.yaml              # User Service Deployment (scale target)
│   ├── user-service.yaml                 # User Service ClusterIP Service (3001)
│   ├── product-deployment.yaml           # Product Service Deployment
│   ├── product-service.yaml              # Product Service ClusterIP Service (3002)
│   ├── order-deployment.yaml             # Order Service Deployment
│   ├── order-service.yaml                # Order Service ClusterIP Service (3003)
│   ├── prometheus-configmap.yaml         # Prometheus scrape configuration
│   ├── prometheus-deployment.yaml        # Prometheus Server Deployment
│   ├── prometheus-service.yaml           # Prometheus NodePort Service (30090)
│   ├── grafana-deployment.yaml           # Grafana Deployment & Datasource config
│   ├── grafana-service.yaml              # Grafana NodePort Service (30300)
│   └── mongodb.yaml                      # (Optional) In-cluster MongoDB for offline testing
├── api-gateway/                          # API Gateway microservice
│   ├── config/serviceRegistry.js
│   ├── server.js                         # Updated with prom-client /metrics & /health
│   ├── Dockerfile
│   └── package.json
├── user-service/                         # User microservice
├── product-service/                      # Product microservice
├── order-service/                        # Order microservice
├── Lab8_Kubernetes_Monitoring.postman_collection.json # Postman Test Suite
├── traffic_generator.sh                  # Traffic generator for Prometheus/Grafana
├── run_verification.sh                   # Automated verification & testing script
├── setup_cluster.sh                      # Cluster bootstrap and image loader
└── Assignment-Lab-8.pdf                  # Official assignment prompt
```

---

## 4. Part A — Kubernetes Deployment Walkthrough

### 4.1 Prerequisites & Cluster Context Verification

Confirm that your Kubernetes cluster is running and `kubectl` points to the active context:

```bash
# Verify active context and available nodes
kubectl config current-context
kubectl get nodes
```

Expected output shows at least 1 node in `Ready` status:
```text
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   1d    v1.28.3
```

### 4.2 Namespace Creation

All resources are isolated in the `lab8` namespace:

```bash
kubectl apply -f k8s/namespace.yaml
# Or: kubectl create namespace lab8
```

### 4.3 Applying Configuration & Manifests

Deploy the configurations, microservices, and monitoring stack:

```bash
# 1. Configuration & Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 2. Microservices & Monitoring
kubectl apply -f k8s/ -n lab8
```

Verify that all deployments, pods, and services are running:

```bash
kubectl get deployments -n lab8
kubectl get pods -n lab8 -o wide
kubectl get services -n lab8
```

Expected output:
```text
NAME                 READY   UP-TO-DATE   AVAILABLE   AGE
gateway-deployment   1/1     1            1           45s
user-service         1/1     1            1           45s
product-service      1/1     1            1           45s
order-service        1/1     1            1           45s
prometheus-deployment 1/1    1            1           45s
grafana-deployment   1/1     1            1           45s
```

### 4.4 Health & Readiness Probes

Each microservice deployment defines **liveness** and **readiness** probes pointing to its native `/health` endpoint:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

- **Liveness Probe**: Ensures the container process is responsive. If `/health` fails 3 times, Kubernetes restarts the container.
- **Readiness Probe**: Prevents sending traffic to pods during boot/startup until the database connection and HTTP listener are fully initialised.

### 4.5 Exposing & Testing the Gateway

The API Gateway is exposed via `NodePort: 30080`:

```bash
# NodePort access:
curl http://localhost:30080/health

# Or using port-forward if preferred:
kubectl port-forward svc/gateway-service 3000:3000 -n lab8 &
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "UP",
  "service": "api-gateway",
  "port": 3000,
  "timestamp": "2026-10-30T09:15:00.000Z",
  "registeredServices": [
    { "path": "/users", "target": "http://user-service:3001", "service": "user-service" },
    { "path": "/products", "target": "http://product-service:3002", "service": "product-service" },
    { "path": "/orders", "target": "http://order-service:3003", "service": "order-service" }
  ]
}
```

### 4.6 Scaling Demonstration

Scale the `user-service` deployment from 1 replica to 3 replicas:

```bash
kubectl scale deployment user-service --replicas=3 -n lab8
kubectl get pods -l app=user-service -n lab8
```

Output demonstrates 3 active replicas:
```text
NAME                            READY   STATUS    RESTARTS   AGE
user-service-6d8b9f784d-2k8nm   1/1     Running   0          4m
user-service-6d8b9f784d-h7xwp   1/1     Running   0          12s
user-service-6d8b9f784d-m4plq   1/1     Running   0          12s
```
The `user-service` `ClusterIP` automatically balances incoming requests from the gateway across all 3 running replicas without downtime.

### 4.7 Self-Healing Demonstration

Delete one of the running pods to observe Kubernetes self-healing:

```bash
# 1. Get pod name
POD=$(kubectl get pods -l app=user-service -n lab8 -o jsonpath='{.items[0].metadata.name}')

# 2. Delete the pod
kubectl delete pod "$POD" -n lab8

# 3. Observe pod recreation
kubectl get pods -l app=user-service -n lab8
```

Kubernetes immediately marks the deleted pod as `Terminating` and schedules a new pod (`ContainerCreating` → `Running`), restoring the replica count to 3.

---

## 5. Part B — GitHub Actions CI/CD Pipeline

The `.github/workflows/ci.yml` pipeline automates continuous integration and container image creation.

### Workflow Stages:
1. **Trigger**: Triggers on `push` or `pull_request` to `main` branch.
2. **Build & Test Matrix**: Runs tests across all 4 microservices concurrently:
   - Checks out code with `actions/checkout@v4`.
   - Sets up Node.js v20.
   - Installs dependencies (`npm install`).
   - Runs tests (`npm test`).
3. **Docker Build & Versioned Tagging**:
   - Builds Docker image tagged with the exact Git commit SHA:
     ```bash
     docker build -t campusconnect-user-service:${{ github.sha }} .
     docker tag campusconnect-user-service:${{ github.sha }} campusconnect-user-service:latest
     ```
4. **Registry Push (GHCR)**:
   - Uses `ghcr.io` with `${{ secrets.GITHUB_TOKEN }}` to publish traceable, immutable artifacts.

---

## 6. Part C — Monitoring with Prometheus & Grafana

### 6.1 Application Metrics Collection (`/metrics`)

The API Gateway incorporates `prom-client` in `api-gateway/server.js`, exposing standard Prometheus metrics and custom application metrics at `GET /metrics`:
- `http_requests_total`: Counter tracking method, route, and HTTP response code.
- `http_request_duration_seconds`: Histogram of request latency.
- `gateway_process_cpu_seconds_total` & `gateway_nodejs_heap_size_total_bytes`: Process health metrics.

### 6.2 Prometheus Configuration & Target Status

Prometheus is deployed in the cluster with `prometheus-configmap.yaml` scraping `gateway-service:3000` every 5 seconds.

Access the Prometheus Web UI at `http://localhost:30090`:
- **Targets Page (`/targets`)**: Shows `gateway` job in state `UP (1/1)`.
- **PromQL Queries**:
  - Check target availability:
    ```promql
    up{job="gateway"}
    ```
  - Real-time request rate (requests/sec over 5m):
    ```promql
    rate(http_requests_total[5m])
    ```
  - Error rate (4xx and 5xx responses):
    ```promql
    sum(rate(http_requests_total{status_code=~"^[45].*"}[5m]))
    ```

### 6.3 Grafana Dashboard

Access Grafana at `http://localhost:30300` (pre-provisioned with Prometheus datasource and anonymous admin access enabled):
1. Navigate to **Dashboards** → **Create Dashboard**.
2. Add Panels for:
   - **Target Availability** (Stat panel): `up{job="gateway"}`
   - **Request Throughput** (Time-series): `sum(rate(http_requests_total[1m])) by (route)`
   - **HTTP Status Codes** (Bar chart/Pie): `sum(http_requests_total) by (status_code)`
   - **Average Request Latency** (Gauge): `rate(http_request_duration_seconds_sum[1m]) / rate(http_request_duration_seconds_count[1m])`

### 6.4 Generating Traffic & Observing Visual Spikes

Run the included automated traffic generator:

```bash
./traffic_generator.sh http://localhost:30080 100 0.05
```

As requests are sent, observe the live query graphs in Prometheus and panel spikes in Grafana.

---

## 7. Submission Checklist & Deliverables Mapping

| Item # | Required Evidence | Deliverable / Command |
|---|---|---|
| **1** | **Lab 7 Baseline** | Postman request/response to `GET /health` and `/users` |
| **2** | **K8s Environment** | `kubectl config current-context` and `kubectl get nodes` |
| **3** | **Manifests** | Complete `k8s/*.yaml` files |
| **4** | **Deployment** | `kubectl get pods,deployments,services -n lab8` |
| **5** | **Gateway Test** | Postman request through NodePort (`http://localhost:30080/health`) |
| **6** | **Scaling** | `kubectl scale deployment user-service --replicas=3 -n lab8` output |
| **7** | **Self-Healing** | `kubectl delete pod` output showing replacement pod creation |
| **8** | **Troubleshooting** | `kubectl describe pod` and `kubectl logs` output |
| **9** | **GitHub Actions** | Screenshot of successful GitHub Actions workflow run |
| **10** | **Prometheus** | Screenshot of Prometheus Targets (`UP` state) and PromQL query |
| **11** | **Grafana** | Screenshot of Grafana Dashboard with active panels |
| **12** | **Traffic** | Grafana dashboard showing request spike after running `traffic_generator.sh` |
| **13** | **Architecture** | End-to-end architecture diagram |

---

## 8. Verification & Execution Script

An automated end-to-end verification script is provided in `run_verification.sh`:

```bash
# Execute verification suite:
./run_verification.sh
```
This tests cluster connectivity, namespaces, pods, health probes, service discovery, scaling, self-healing, and monitoring endpoints in a single run.
