.PHONY: help build up down logs clean test dev prod health

# Default target
help:
	@echo "Mini-Judge Docker Management"
	@echo ""
	@echo "Available commands:"
	@echo "  build    - Build the Docker image"
	@echo "  up       - Start the judge in production mode"
	@echo "  down     - Stop and remove containers"
	@echo "  logs     - View container logs"
	@echo "  clean    - Remove containers, images, and volumes"
	@echo "  test     - Run tests in container"
	@echo "  dev      - Start in development mode"
	@echo "  prod     - Start in production mode"
	@echo "  health   - Check health status"
	@echo "  setup    - Run setup script"
	@echo "  install  - Install dependencies"

# Build the Docker image
build:
	docker-compose build

# Start in production mode
up:
	docker-compose up -d

# Start in development mode
dev:
	docker-compose -f docker-compose.dev.yml up

# Start in production mode (alias)
prod: up

# Stop containers
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Clean everything
clean:
	docker-compose down -v --rmi all
	docker system prune -f

# Run tests
test:
	docker-compose exec mini-judge npm test

# Check health
health:
	@echo "Checking judge health..."
	@curl -s http://localhost:3000/health | jq . || echo "Judge not responding"

# Run setup script
setup:
	./scripts/docker-setup.sh

# Install dependencies
install:
	./scripts/install.sh

# Quick restart
restart:
	docker-compose restart

# Show container status
status:
	docker-compose ps

# Enter container shell
shell:
	docker-compose exec mini-judge sh

# Update problems (restart after adding new problems)
update-problems:
	docker-compose restart mini-judge 