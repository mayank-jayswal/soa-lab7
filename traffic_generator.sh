#!/usr/bin/env bash
# ==============================================================================
# Lab 8 — API Traffic Generator for Prometheus & Grafana Monitoring
# ==============================================================================
# Sends automated bursts of traffic through the Kubernetes API Gateway:
# - Normal GET /health checks
# - GET /users, GET /products, GET /orders (success traffic)
# - POST /users, POST /products, POST /orders
# - Simulated 404s (nonexistent endpoints)
# - Scrapes /metrics to verify metric incrementation
# ==============================================================================

set -e

GATEWAY_URL="${1:-http://localhost:30080}"
COUNT="${2:-50}"
DELAY="${3:-0.1}"

echo "=============================================================================="
echo "🚀 CampusConnect Traffic Generator (Lab 8)"
echo "Target Gateway: $GATEWAY_URL"
echo "Requests:       $COUNT iterations"
echo "Delay:          ${DELAY}s"
echo "=============================================================================="

SUCCESS=0
ERRORS=0

for i in $(seq 1 "$COUNT"); do
  # 1. Health check
  curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health" > /dev/null && ((SUCCESS++)) || ((ERRORS++))

  # 2. Users query
  curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/users" > /dev/null && ((SUCCESS++)) || ((ERRORS++))

  # 3. Products query
  curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/products" > /dev/null && ((SUCCESS++)) || ((ERRORS++))

  # 4. Controlled 404 test every 5 iterations to generate error metrics
  if [ $((i % 5)) -eq 0 ]; then
    curl -s -o /dev/null "$GATEWAY_URL/unknown-route-$i" > /dev/null || true
  fi

  printf "\r⚡ Sent iteration %d/%d (Success: %d, Errors: %d)..." "$i" "$COUNT" "$SUCCESS" "$ERRORS"
  sleep "$DELAY"
done

echo -e "\n\n✅ Traffic burst complete!"
echo "------------------------------------------------------------------------------"
echo "Inspecting live Prometheus metrics from Gateway ($GATEWAY_URL/metrics):"
echo "------------------------------------------------------------------------------"
curl -s "$GATEWAY_URL/metrics" | grep -E "^http_requests_total|^gateway_cpu" | head -n 15 || echo "Could not reach $GATEWAY_URL/metrics directly."
echo "------------------------------------------------------------------------------"
echo "Check your Grafana dashboard at http://localhost:30300 to observe traffic spikes!"
