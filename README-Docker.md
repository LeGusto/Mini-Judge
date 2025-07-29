# Mini-Judge Docker Setup

This document explains how to deploy Mini-Judge using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Docker socket access (for Docker-in-Docker)

## Quick Start

### 1. Automated Setup

Run the setup script:
```bash
./scripts/docker-setup.sh
```

### 2. Manual Setup

1. **Build the image:**
   ```bash
   docker-compose build
   ```

2. **Start the judge:**
   ```bash
   # Production mode
   docker-compose up -d
   
   # Development mode (with source mounting)
   docker-compose -f docker-compose.dev.yml up
   ```

3. **Check status:**
   ```bash
   docker-compose ps
   curl http://localhost:3000/health
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port to run the judge on |
| `NODE_ENV` | `production` | Node.js environment |
| `MAX_WORKERS` | `3` | Maximum concurrent submissions |
| `BACKEND_URL` | `http://host.docker.internal:5000` | Backend service URL |

### Volume Mounts

- `/var/run/docker.sock` - Docker socket for container execution
- `./problems:/app/problems:ro` - Problem files (read-only)
- `./tmp:/app/tmp` - Temporary files

## Docker-in-Docker (DinD)

Mini-Judge uses Docker-in-Docker to execute user code in isolated containers. This requires:

1. **Privileged mode** - Container needs elevated privileges
2. **Docker socket access** - To communicate with Docker daemon
3. **Docker group** - To access Docker socket

### Security Considerations

- The container runs in privileged mode
- Only mount necessary volumes
- Use read-only mounts where possible
- Consider using Docker's security options

## Development

### Development Mode

```bash
docker-compose -f docker-compose.dev.yml up
```

Features:
- Source code mounting for hot reload
- Debug logging enabled
- Reduced worker count for faster iteration

### Testing

```bash
# Run tests in container
docker-compose exec mini-judge npm test

# Run tests with coverage
docker-compose exec mini-judge npm run test:coverage
```

## Production Deployment

### 1. Build Production Image

```bash
docker-compose build
```

### 2. Deploy with Docker Compose

```bash
docker-compose up -d
```

### 3. Monitor

```bash
# View logs
docker-compose logs -f

# Check health
curl http://localhost:3000/health

# View container stats
docker stats mini-judge
```

### 4. Update Problems

To add new problems:

1. Add problem files to `./problems/` directory
2. Restart the container:
   ```bash
   docker-compose restart
   ```

## Troubleshooting

### Common Issues

1. **Permission Denied on Docker Socket**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

2. **Container Can't Access Docker**
   - Ensure container is running in privileged mode
   - Check Docker socket is mounted correctly
   - Verify Docker group is added

3. **Port Already in Use**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "3001:3000"  # Use port 3001 instead
   ```

4. **Memory Issues**
   ```bash
   # Increase memory limit
   deploy:
     resources:
       limits:
         memory: 2G
   ```

### Logs and Debugging

```bash
# View logs
docker-compose logs -f mini-judge

# Enter container
docker-compose exec mini-judge sh

# Check Docker daemon access
docker-compose exec mini-judge docker ps
```

## Scaling

### Multiple Judge Instances

```bash
# Scale to multiple instances
docker-compose up -d --scale mini-judge=3
```

### Load Balancing

Use a reverse proxy (nginx, traefik) to distribute load:

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - mini-judge
```

## Security Best Practices

1. **Use non-root user** (already configured in Dockerfile)
2. **Limit container resources**
3. **Use read-only filesystem where possible**
4. **Regular security updates**
5. **Monitor container logs**
6. **Use secrets for sensitive data**

## Performance Tuning

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### Worker Configuration

Adjust `MAX_WORKERS` based on:
- Available CPU cores
- Memory constraints
- Expected load

## Monitoring

### Health Checks

The container includes a health check endpoint:
```bash
curl http://localhost:3000/health
```

### Metrics

Consider adding monitoring:
- Prometheus metrics
- Application performance monitoring
- Container resource monitoring

## Backup and Recovery

### Problem Files

```bash
# Backup problems
tar -czf problems-backup.tar.gz problems/

# Restore problems
tar -xzf problems-backup.tar.gz
```

### Configuration

```bash
# Backup configuration
cp docker-compose.yml docker-compose.yml.backup

# Restore configuration
cp docker-compose.yml.backup docker-compose.yml
``` 