#!/usr/bin/env bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}========================================${NC}"
echo -e "${BLUE}${BOLD}   Putting News Dashboard to Sleep      ${NC}"
echo -e "${BLUE}${BOLD}========================================${NC}"

# Find and stop server (port 5001)
SERVER_PIDS=$(lsof -ti :5001 2>/dev/null)
if [ -n "$SERVER_PIDS" ]; then
    echo -e "${YELLOW}Stopping Express backend on port 5001 (PID: $SERVER_PIDS)...${NC}"
    for pid in $SERVER_PIDS; do
        kill -TERM "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
    done
    sleep 1
    echo -e "${GREEN}✓ Express backend stopped.${NC}"
else
    echo -e "Express backend was not running on port 5001."
fi

# Find and stop client (port 5173)
CLIENT_PIDS=$(lsof -ti :5173 2>/dev/null)
if [ -n "$CLIENT_PIDS" ]; then
    echo -e "${YELLOW}Stopping Vite frontend on port 5173 (PID: $CLIENT_PIDS)...${NC}"
    for pid in $CLIENT_PIDS; do
        kill -TERM "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
    done
    sleep 1
    echo -e "${GREEN}✓ Vite frontend stopped.${NC}"
else
    echo -e "Vite frontend was not running on port 5173."
fi

# Find and stop any background worker processes
WORKER_PIDS=$(pgrep -f "src/worker.ts" 2>/dev/null)
if [ -n "$WORKER_PIDS" ]; then
    echo -e "${YELLOW}Stopping scraping worker (PID: $WORKER_PIDS)...${NC}"
    for pid in $WORKER_PIDS; do
        kill -TERM "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
    done
    sleep 1
    echo -e "${GREEN}✓ Worker stopped.${NC}"
fi

# Stop any lingering ts-node / vite processes started in this repo
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINGERING_PIDS=$(pgrep -f "$REPO_DIR.*(ts-node|vite)" 2>/dev/null)
if [ -n "$LINGERING_PIDS" ]; then
    echo -e "${YELLOW}Cleaning up lingering app processes ($LINGERING_PIDS)...${NC}"
    for pid in $LINGERING_PIDS; do
        kill -9 "$pid" 2>/dev/null
    done
fi

echo ""
echo -e "${GREEN}${BOLD}✓ System load successfully reduced to 0!${NC}"
echo -e "All dev servers, hot-reloaders, and background scrapers are in hibernation."
echo -e "To wake the application up at any time, run: ${BLUE}${BOLD}npm run resume${NC}"
echo -e "${BLUE}${BOLD}========================================${NC}"
