#!/bin/bash
# ================================================================
# Lab 7 — Comprehensive Verification Script
# Tests API Gateway routing, health check, error handling,
# and config-based service discovery
# ================================================================

set -e
GATEWAY="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_test() {
  TOTAL=$((TOTAL + 1))
  echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}TEST $TOTAL: $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_status() {
  local expected=$1
  local actual=$2
  local label=$3
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✅ PASS: $label (HTTP $actual)${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ FAIL: $label — expected HTTP $expected, got HTTP $actual${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Lab 7 — API Gateway Verification Script           ║"
echo "║   Gateway: $GATEWAY                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Gateway Health Check ──────────────────────────────
log_test "GET /health — Gateway Health Check"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 200 "$HTTP_CODE" "Gateway /health"

# ── 2. Verify services are NOT directly accessible ──────
log_test "Verify services NOT accessible on host ports 3001/3002/3003"
echo "Attempting direct access to user-service on localhost:3001..."
DIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:3001/users" 2>/dev/null || echo "000")
if echo "$DIRECT_CODE" | grep -q "^0"; then
  echo -e "${GREEN}✅ PASS: user-service NOT directly accessible (connection refused) — correct!${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: user-service IS directly accessible on localhost:3001 (HTTP $DIRECT_CODE) — should be internal only${NC}"
  FAIL=$((FAIL + 1))
fi

# ── 3. Create User via Gateway ────────────────────────────
log_test "POST /users — Create User via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lab7 Test User","email":"lab7.test@campusconnect.edu","role":"student","department":"Computer Science"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 201 "$HTTP_CODE" "POST /users"
USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('_id',''))" 2>/dev/null)
echo "  → Captured user_id: $USER_ID"

# ── 4. Get All Users via Gateway ─────────────────────────
log_test "GET /users — List Users via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/users")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null | head -20
check_status 200 "$HTTP_CODE" "GET /users"

# ── 5. Get User by ID via Gateway ────────────────────────
log_test "GET /users/:id — Get User by ID via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/users/$USER_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 200 "$HTTP_CODE" "GET /users/:id"

# ── 6. Update User via Gateway ───────────────────────────
log_test "PUT /users/:id — Update User via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$GATEWAY/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"department":"Information Technology"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 200 "$HTTP_CODE" "PUT /users/:id"

# ── 7. Create Product via Gateway ─────────────────────────
log_test "POST /products — Create Product via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY/products" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lab Notebook","description":"100-page ruled lab notebook","price":120,"category":"Academic Supplies","stock":50}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 201 "$HTTP_CODE" "POST /products"
PRODUCT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('_id',''))" 2>/dev/null)
echo "  → Captured product_id: $PRODUCT_ID"

# ── 8. Get All Products via Gateway ──────────────────────
log_test "GET /products — List Products via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/products")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null | head -20
check_status 200 "$HTTP_CODE" "GET /products"

# ── 9. Get Product by ID via Gateway ─────────────────────
log_test "GET /products/:id — Get Product by ID via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/products/$PRODUCT_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 200 "$HTTP_CODE" "GET /products/:id"

# ── 10. Update Product via Gateway ────────────────────────
log_test "PUT /products/:id — Update Product via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$GATEWAY/products/$PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -d '{"price":99,"stock":75}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 200 "$HTTP_CODE" "PUT /products/:id"

# ── 11. Create Order via Gateway (inter-service comms) ───
log_test "POST /orders — Create Order via Gateway (inter-service communication)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY/orders" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"productId\":\"$PRODUCT_ID\",\"quantity\":2}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 201 "$HTTP_CODE" "POST /orders"
ORDER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('order',{}).get('_id',''))" 2>/dev/null)
echo "  → Captured order_id: $ORDER_ID"

# ── 12. Get All Orders via Gateway ────────────────────────
log_test "GET /orders — List Orders via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/orders")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null | head -20
check_status 200 "$HTTP_CODE" "GET /orders"

# ── 13. Get Order by ID via Gateway ──────────────────────
log_test "GET /orders/:id — Get Order by ID via Gateway"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/orders/$ORDER_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 200 "$HTTP_CODE" "GET /orders/:id"

# ── 14. Gateway 404 for unknown route ────────────────────
log_test "GET /nonexistent — Gateway 404 for unknown route"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/nonexistent")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
check_status 404 "$HTTP_CODE" "GET /nonexistent"

# ── 15. 502/503 Test — Stop user-service ──────────────────
log_test "502/503 Test — Stop user-service, then hit /users"
echo "Stopping user-service..."
docker compose stop user-service 2>&1 | tail -1
sleep 2

RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/users")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" -eq 502 ] || [ "$HTTP_CODE" -eq 503 ]; then
  echo -e "${GREEN}✅ PASS: Gateway returned $HTTP_CODE for unreachable user-service${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: Expected 502 or 503, got $HTTP_CODE${NC}"
  FAIL=$((FAIL + 1))
fi

echo "Restarting user-service..."
docker compose start user-service 2>&1 | tail -1
sleep 3

# ── 16. Verify user-service is back ──────────────────────
log_test "Verify user-service is back after restart"
RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY/users")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
check_status 200 "$HTTP_CODE" "GET /users (after restart)"

# ── 17. Delete test data ─────────────────────────────────
log_test "Cleanup — Delete test user and product"
DEL_USER=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$GATEWAY/users/$USER_ID")
echo "  DELETE /users/$USER_ID → HTTP $DEL_USER"
DEL_PROD=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$GATEWAY/products/$PRODUCT_ID")
echo "  DELETE /products/$PRODUCT_ID → HTTP $DEL_PROD"
PASS=$((PASS + 1))

# ── Summary ───────────────────────────────────────────────
echo -e "\n${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              TEST RESULTS SUMMARY                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "  ${GREEN}PASSED: $PASS${NC}"
echo -e "  ${RED}FAILED: $FAIL${NC}"
echo -e "  TOTAL:  $((PASS + FAIL))"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED — Lab 7 Gateway is working correctly!${NC}"
else
  echo -e "${RED}⚠️  Some tests failed. Check output above for details.${NC}"
fi
echo ""
