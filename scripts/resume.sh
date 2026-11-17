#!/usr/bin/env bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo -e "${BLUE}${BOLD}========================================${NC}"
echo -e "${BLUE}${BOLD}      Waking Up News Dashboard          ${NC}"
echo -e "${BLUE}${BOLD}========================================${NC}"

# 1. Verify Redis
echo -e "${YELLOW}Checking Redis on :6379...${NC}"
if ! nc -z localhost 6379 2>/dev/null; then
    echo -e "${YELLOW}Redis is not reachable. Starting local redis-server...${NC}"
    if [ -x "/opt/homebrew/bin/redis-server" ]; then
        /opt/homebrew/bin/redis-server --daemonize yes
        sleep 1
    fi
fi

if nc -z localhost 6379 2>/dev/null; then
    echo -e "${GREEN}✓ Redis is active.${NC}"
else
    echo -e "${RED}✗ Redis could not be contacted. Scraping queue may fail.${NC}"
fi

# 2. Verify MongoDB
echo -e "${YELLOW}Checking MongoDB on :27017...${NC}"
if nc -z localhost 27017 2>/dev/null; then
    echo -e "${GREEN}✓ MongoDB is active.${NC}"
else
    echo -e "${YELLOW}Starting MongoDB daemon...${NC}"
    if [ -x "/opt/homebrew/bin/mongod" ]; then
        /opt/homebrew/bin/mongod --fork --logpath "$REPO_DIR/logs/mongod.log" --dbpath /opt/homebrew/var/mongodb 2>/dev/null || true
        sleep 1
    fi
    if nc -z localhost 27017 2>/dev/null; then
        echo -e "${GREEN}✓ MongoDB started successfully.${NC}"
    else
        echo -e "${RED}✗ MongoDB could not be reached. Backend may fail to connect.${NC}"
    fi
fi

mkdir -p "$REPO_DIR/logs"

# 3. Start Express backend
echo -e "${YELLOW}Starting Express backend (port 5001)...${NC}"
(cd "$REPO_DIR/server" && npx ts-node --transpile-only src/index.ts > "$REPO_DIR/logs/server.log" 2>&1) &

# 4. Start Worker
echo -e "${YELLOW}Starting Scraper Worker...${NC}"
(cd "$REPO_DIR/server" && npx ts-node --transpile-only src/worker.ts > "$REPO_DIR/logs/worker.log" 2>&1) &

# 5. Start Vite frontend
echo -e "${YELLOW}Starting Vite frontend (port 5173)...${NC}"
(cd "$REPO_DIR/client" && npm run dev > "$REPO_DIR/logs/client.log" 2>&1) &

# 6. Wait for services to be ready
echo -e "${YELLOW}Waiting for services to become ready...${NC}"
READY=false
for i in {1..30}; do
    if nc -z localhost 5001 2>/dev/null && nc -z localhost 5173 2>/dev/null; then
        READY=true
        break
    fi
    sleep 1
    printf "."
done
echo ""

if [ "$READY" = true ]; then
    echo -e "${GREEN}${BOLD}✓ All services are UP and running!${NC}"
    echo -e "  - Frontend: ${BLUE}${BOLD}http://localhost:5173${NC}"
    echo -e "  - Backend:  ${BLUE}${BOLD}http://localhost:5001${NC}"
    echo -e "  - Logs:     ${REPO_DIR}/logs/"
else
    echo -e "${YELLOW}⚠ Services started in background, but ports took longer to bind.${NC}"
    echo -e "Check ${REPO_DIR}/logs/server.log and client.log for details."
fi

# 7. Interactive Catch-up Prompt (Per Interview Decision)
echo ""
echo -e "${BLUE}${BOLD}----------------------------------------${NC}"
read -p "Would you like to trigger an immediate catch-up scrape now? (y/N): " choice
case "$choice" in 
  y|Y )
    echo -e "${YELLOW}Triggering catch-up scrape job...${NC}"
    SCRAPE_RES=$(curl -s -X POST http://localhost:5001/api/scrape-and-email)
    echo -e "${GREEN}✓ Scrape initiated: $SCRAPE_RES${NC}"
    ;;
  * )
    echo -e "Skipped catch-up scrape. Running passively according to schedule."
    ;;
esac
echo -e "${BLUE}${BOLD}========================================${NC}"
