#!/bin/bash

echo "Comprehensive Health Check"
echo "============================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
  local name=$1
  local url=$2

  if curl -f -s "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name is healthy"
    return 0
  else
    echo -e "${RED}✗${NC} $name is DOWN"
    return 1
  fi
}

echo ""
echo "Microservices:"
check_service "API Gateway       " "http://localhost:3000/health"
#check_service "Auth Service      " "http://localhost:3001/health"
#check_service "Suggestion Service" "http://localhost:3002/health"
#check_service "History Service   " "http://localhost:3003/health"

echo ""
echo "Infrastructure:"
check_service "Consul          " "http://localhost:8500/v1/status/leader"
check_service "RabbitMQ        " "http://localhost:15672"
check_service "Prometheus      " "http://localhost:9090/-/healthy"
check_service "Grafana         " "http://localhost:3050/api/health"

echo ""
echo "Databases:"

# PostgreSQL Auth
if docker exec postgres-auth pg_isready -U auth_user > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} PostgreSQL Auth"
else
  echo -e "${RED}✗${NC} PostgreSQL Auth"
fi

# PostgreSQL Suggestions
if docker exec postgres-suggestions pg_isready -U suggestions_user > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} PostgreSQL Suggestions"
else
  echo -e "${RED}✗${NC} PostgreSQL Suggestions"
fi

# MongoDB
if docker exec mongodb mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} MongoDB"
else
  echo -e "${RED}✗${NC} MongoDB"
fi

# Redis
if docker exec redis redis-cli ping > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Redis"
else
  echo -e "${RED}✗${NC} Redis"
fi

echo ""
echo "Service Discovery (Consul):"
curl -s http://localhost:8500/v1/catalog/services | \
  python3 -c "import sys, json; [print(k) for k in json.load(sys.stdin).keys()]" | \
  while read service; do
    healthy=$(curl -s "http://localhost:8500/v1/health/service/$service?passing=true" | \
              python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
    if [ "$healthy" -gt 0 ]; then
      echo -e "${GREEN}✓${NC} $service ($healthy instances)"
    else
      echo -e "${YELLOW}⚠${NC} $service (0 healthy instances)"
    fi
  done
