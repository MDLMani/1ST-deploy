#!/usr/bin/env bash
# Allow phones on same WiFi to reach the backend on port 5001
set -euo pipefail

PORT=5001
LAN_IP=$(hostname -I | awk '{print $1}')

echo "LAN IP: $LAN_IP"
echo "Opening port $PORT for local network access..."

if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow "$PORT/tcp" || true
  sudo ufw status | grep "$PORT" || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  sudo firewall-cmd --add-port="$PORT/tcp" --permanent || true
  sudo firewall-cmd --reload || true
else
  echo "No ufw/firewalld found. If phone still cannot connect, disable firewall or allow TCP $PORT manually."
fi

echo ""
echo "Backend URLs:"
echo "  http://localhost:$PORT"
echo "  http://$LAN_IP:$PORT"
echo "  http://$LAN_IP:$PORT/health"
echo ""
echo "Test from phone browser: http://$LAN_IP:$PORT/health"
