#!/bin/bash

# Mini-Judge Docker Setup Script
set -e

echo "🚀 Setting up Mini-Judge Docker environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p tmp
mkdir -p problems

# Set proper permissions for Docker socket
echo "🔧 Setting up Docker permissions..."
if [ -S /var/run/docker.sock ]; then
    sudo chmod 666 /var/run/docker.sock
    echo "✅ Docker socket permissions updated"
else
    echo "⚠️  Docker socket not found. Make sure Docker is running."
fi

# Build the Docker image
echo "🔨 Building Docker image..."
docker-compose build

echo "✅ Setup complete!"
echo ""
echo "To start the judge in production mode:"
echo "  docker-compose up -d"
echo ""
echo "To start the judge in development mode:"
echo "  docker-compose -f docker-compose.dev.yml up"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop the judge:"
echo "  docker-compose down" 