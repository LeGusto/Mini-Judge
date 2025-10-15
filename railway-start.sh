#!/bin/bash

# Railway startup script for Mini-Judge
set -e

echo "🚀 Starting Mini-Judge on Railway..."

# Wait for Docker to be available
echo "⏳ Waiting for Docker to be ready..."
until docker info >/dev/null 2>&1; do
  echo "Docker is unavailable - sleeping"
  sleep 2
done

echo "✅ Docker is ready!"

# Pull required Docker images
echo "📥 Pulling required Docker images..."
docker pull python:3.12-slim
docker pull gcc:12

echo "🎯 Starting Judge server..."
exec node src/server.js
