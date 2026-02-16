#!/bin/bash
# GeekSpace Docker Cleanup
echo "=== Removing exited containers ==="
docker container prune -f
echo ""
echo "=== Removing dangling images ==="
docker image prune -f
echo ""
echo "=== Removing build cache ==="
docker builder prune -f --filter until=72h
echo ""
echo "=== Current containers ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== Disk usage ==="
docker system df
echo ""
echo "=== Network connectivity test ==="
docker exec geekspace-app curl -sf http://ollama-qtzz-ollama-1:11434/api/tags > /dev/null 2>&1 && echo "✅ Ollama: reachable" || echo "❌ Ollama: not reachable"
docker exec geekspace-redis redis-cli ping 2>/dev/null | grep -q PONG && echo "✅ Redis: reachable" || echo "❌ Redis: not reachable"
