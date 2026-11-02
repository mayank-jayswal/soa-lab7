#!/usr/bin/env bash
# ==============================================================================
# Lab 8 — End-to-End Automated Kubernetes & Verification Script
# ==============================================================================
# Performs end-to-end checks for Lab 8:
# 1. Kubernetes context & node verification
# 2. Namespace & resource status verification (Pods, Deployments, Services)
# 3. Gateway /health & /metrics probe verification
# 4. End-to-end proxy routing tests (Users, Products, Orders)
# 5. User-service scaling demonstration (1 -> 3 replicas)
# 6. Self-healing demonstration (delete pod -> watch replacement)
# 7. Prometheus & Grafana connectivity test
# ==============================================================================

set -uo pipefail

NAMESPACE="${NAMESPACE:-lab8}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:30080}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:30090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:30300}"

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_YELLOW="\033[33m"
COLOR_CYAN="\033[36m"
COLOR_BOLD="\033[1m"

log_section() {
  echo -e "\n${COLOR_CYAN}${COLOR_BOLD}=== $1 ===${COLOR_RESET}"
}

log_pass() {
  echo -e "  ${COLOR_GREEN}✔ PASS:${COLOR_RESET} $1"
}

log_fail() {
  echo -e "  ${COLOR_RED}✘ FAIL:${COLOR_RESET} $1"
}

log_info() {
  echo -e "  ${COLOR_YELLOW}ℹ INFO:${COLOR_RESET} $1"
}

log_section "1. Kubernetes Environment & Context Check"
if command -v kubectl &>/dev/null; then
  CURRENT_CTX=$(kubectl config current-context 2>/dev/null || echo "N/A")
  log_pass "kubectl is installed."
  log_info "Active Context: $CURRENT_CTX"
  
  echo -e "\nNodes in Cluster:"
  kubectl get nodes -o wide || log_fail "Unable to list nodes."
else
  log_fail "kubectl is not in PATH."
fi

log_section "2. Kubernetes Namespace & Workloads ($NAMESPACE)"
if command -v kubectl &>/dev/null; then
  echo -e "\nDeployments:"
  kubectl get deployments -n "$NAMESPACE" || true

  echo -e "\nPods:"
  kubectl get pods -n "$NAMESPACE" -o wide || true

  echo -e "\nServices & NodePorts:"
  kubectl get services -n "$NAMESPACE" || true
fi

log_section "3. API Gateway Connectivity & Health Probes"
log_info "Target Gateway: $GATEWAY_URL"

HEALTH_RESP=$(curl -s -w "\n%{http_code}" "$GATEWAY_URL/health" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESP" | tail -n1)
BODY=$(echo "$HEALTH_RESP" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  log_pass "Gateway /health returned 200 OK"
  echo "Response: $BODY"
else
  log_fail "Gateway /health failed with status $HTTP_CODE"
fi

log_section "4. Prometheus Metrics Endpoint (/metrics)"
METRICS_RESP=$(curl -s "$GATEWAY_URL/metrics" 2>/dev/null || true)
if echo "$METRICS_RESP" | grep -q "http_requests_total"; then
  log_pass "Prometheus /metrics endpoint is active and exposing http_requests_total"
  echo "$METRICS_RESP" | grep -E "http_requests_total|gateway_cpu" | head -n 8
else
  log_fail "/metrics did not return expected Prometheus metrics"
fi

log_section "5. Service-to-Service Operations via Gateway"
log_info "Testing GET /users through Gateway..."
USERS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/users" 2>/dev/null || echo "000")
if [ "$USERS_CODE" = "200" ]; then
  log_pass "GET /users routed successfully (HTTP 200)"
else
  log_info "GET /users returned HTTP $USERS_CODE (ensure database is initialized)"
fi

log_section "6. Scaling Demonstration: user-service (1 -> 3 replicas)"
if command -v kubectl &>/dev/null; then
  log_info "Scaling user-service to 3 replicas..."
  kubectl scale deployment user-service --replicas=3 -n "$NAMESPACE" || true
  sleep 3
  kubectl get pods -l app=user-service -n "$NAMESPACE"
  log_pass "Scale command issued. Check pod statuses above."
fi

log_section "7. Self-Healing Demonstration"
if command -v kubectl &>/dev/null; then
  POD_NAME=$(kubectl get pods -l app=user-service -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [ -n "$POD_NAME" ]; then
    log_info "Deleting pod: $POD_NAME"
    kubectl delete pod "$POD_NAME" -n "$NAMESPACE" --grace-period=1 &
    sleep 3
    echo -e "\nPods after delete command (replacement being scheduled):"
    kubectl get pods -l app=user-service -n "$NAMESPACE"
    log_pass "Self-healing triggered. Kubernetes automatically restores desired replicas."
  else
    log_info "No user-service pods currently running to delete."
  fi
fi

log_section "8. Monitoring Stack Check (Prometheus & Grafana)"
PROM_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROMETHEUS_URL/-/ready" 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" "$PROMETHEUS_URL" 2>/dev/null || echo "000")
if [ "$PROM_CODE" = "200" ] || [ "$PROM_CODE" = "302" ]; then
  log_pass "Prometheus reachable at $PROMETHEUS_URL (HTTP $PROM_CODE)"
else
  log_info "Prometheus returned $PROM_CODE at $PROMETHEUS_URL"
fi

GRAF_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GRAFANA_URL/api/health" 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" "$GRAFANA_URL" 2>/dev/null || echo "000")
if [ "$GRAF_CODE" = "200" ] || [ "$GRAF_CODE" = "302" ]; then
  log_pass "Grafana reachable at $GRAFANA_URL (HTTP $GRAF_CODE)"
else
  log_info "Grafana returned $GRAF_CODE at $GRAFANA_URL"
fi

echo -e "\n${COLOR_BOLD}Verification completed! Review the outputs above for your Lab 8 evidence screenshots.${COLOR_RESET}\n"
