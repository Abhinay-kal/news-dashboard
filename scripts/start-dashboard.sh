#!/bin/bash
set -euo pipefail

APP_DIR="/Users/abhinaykalkhanday/Desktop/news-dashboard"
LOG_DIR="$HOME/Library/Logs/news-dashboard"
NODE="/Users/abhinaykalkhanday/.hermes/node/bin/node"
NPM_CLI="/Users/abhinaykalkhanday/.hermes/node/lib/node_modules/npm/bin/npm-cli.js"
L SOF="/usr/sbin/lsof"

mkdir -p "$LOG_DIR"
cd "$APP_DIR"

port_listening() {
	"$LSOF" -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

SERVER_STARTED=0
CLIENT_STARTED=0

if ! port_listening 5000; then
	"$NODE" "$NPM_CLI" --prefix server run dev >> "$LOG_DIR/server.log" 2>&1 &
	SERVER_PID=$!
	SERVER_STARTED=1
fi

if ! port_listening 5173; then
	"$NODE" "$NPM_CLI" --prefix client run dev >> "$LOG_DIR/client.log" 2>&1 &
	CLIENT_PID=$!
	CLIENT_STARTED=1
fi

if [ "$SERVER_STARTED" -eq 0 ] && [ "$CLIENT_STARTED" -eq 0 ]; then
	exit 0
fi

cleanup() {
	if [ "${SERVER_STARTED:-0}" -eq 1 ]; then
		kill "$SERVER_PID" 2>/dev/null || true
	fi
	if [ "${CLIENT_STARTED:-0}" -eq 1 ]; then
		kill "$CLIENT_PID" 2>/dev/null || true
	fi
}

trap cleanup INT TERM EXIT

while :; do
	if [ "$SERVER_STARTED" -eq 1 ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
		cleanup
		exit 1
	fi
	if [ "$CLIENT_STARTED" -eq 1 ] && ! kill -0 "$CLIENT_PID" 2>/dev/null; then
		cleanup
		exit 1
	fi
	sleep 5
done

cleanup
