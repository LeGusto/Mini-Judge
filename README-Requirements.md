# Mini-Judge Requirements

This document outlines all requirements for running Mini-Judge, including dependencies, system requirements, and installation instructions.

## Quick Installation

### Automated Installation
```bash
# Run the automated installation script
./scripts/install.sh
```

### Manual Installation
```bash
# Install Node.js dependencies
npm install

# Create necessary directories
mkdir -p tmp problems

# Set permissions
chmod +x scripts/docker-setup.sh
```

## System Requirements

### Minimum Requirements
- **OS**: Linux (recommended), macOS, Windows with WSL2
- **CPU**: 1 core
- **RAM**: 512MB
- **Storage**: 1GB free space
- **Network**: Internet access for Docker images

### Recommended Requirements
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+, or similar)
- **CPU**: 2+ cores
- **RAM**: 2GB+
- **Storage**: 5GB+ free space
- **Network**: Stable internet connection

## Software Dependencies

### Required Software

#### Node.js
- **Version**: 18.0.0 or higher
- **Installation**: [https://nodejs.org/](https://nodejs.org/)
- **Verification**: `node --version`

#### npm
- **Version**: 8.0.0 or higher (usually bundled with Node.js)
- **Verification**: `npm --version`

#### Docker
- **Version**: 20.10.0 or higher
- **Installation**: [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/)
- **Verification**: `docker --version`
- **Note**: Docker daemon must be running

### Optional Software

#### Development Tools
- **Git**: For version control
- **Make**: For using Makefile commands
- **curl**: For health checks
- **jq**: For JSON processing in scripts

## Node.js Dependencies

### Production Dependencies
```
dockerode@^4.0.7    # Docker API client
express@^5.1.0      # Web framework
multer@^2.0.1       # File upload middleware
tar@^7.4.3          # Archive handling
zod@^3.25.76        # Schema validation
```

### Development Dependencies
```
jest@^30.0.3        # Testing framework
fs-extra@^11.3.0    # Enhanced file system operations
supertest@^7.0.0    # HTTP testing
```

## Docker Requirements

### Docker Images Used
Mini-Judge executes user code in the following Docker images:

#### Python
- **Image**: `python:3.12-slim`
- **Purpose**: Python code execution
- **Size**: ~50MB

#### C++
- **Image**: `gcc:12`
- **Purpose**: C++ code compilation and execution
- **Size**: ~1.2GB

### Docker Configuration
- **Docker-in-Docker**: Required for code execution
- **Privileged Mode**: Required for container management
- **Socket Access**: `/var/run/docker.sock` must be accessible
- **Network**: Container networking enabled

## Environment Variables

### Required Environment Variables
None (all have defaults)

### Optional Environment Variables
```bash
# Server Configuration
PORT=3000                           # Server port
NODE_ENV=production                 # Environment mode

# Performance Configuration
MAX_WORKERS=3                       # Concurrent submissions

# Integration Configuration
BACKEND_URL=http://localhost:5000   # Backend service URL
```

## File System Requirements

### Directory Structure
```
Mini-Judge/
├── src/                    # Source code
├── problems/               # Problem definitions
├── tmp/                    # Temporary files
├── tests/                  # Test files
└── scripts/                # Utility scripts
```

### Permissions
- **Read/Write**: `tmp/` directory
- **Read**: `problems/` directory
- **Execute**: All script files

### Disk Space
- **Minimum**: 1GB for basic operation
- **Recommended**: 5GB+ for multiple problems and submissions

## Network Requirements

### Inbound Connections
- **Port 3000**: HTTP API (configurable)

### Outbound Connections
- **Docker Hub**: For pulling execution images
- **Backend Service**: For webhook notifications (optional)

### Firewall Configuration
```bash
# Allow inbound connections to judge
sudo ufw allow 3000

# Allow Docker traffic
sudo ufw allow from 172.16.0.0/12
```

## Security Requirements

### Docker Security
- **AppArmor**: Recommended for container isolation
- **SELinux**: Supported but may require configuration
- **User Namespaces**: Optional for additional isolation

### File System Security
- **Non-root User**: Container runs as non-root user
- **Read-only Mounts**: Problem files mounted read-only
- **Temporary Files**: Automatically cleaned up

### Network Security
- **CORS**: Configured for specific origins
- **Rate Limiting**: Implemented in queue manager
- **Input Validation**: All inputs validated with Zod

## Performance Requirements

### Resource Limits
```bash
# Memory limits per submission
MEMORY_LIMIT=256MB          # Default memory limit

# Time limits per submission
TIME_LIMIT=1000ms           # Default time limit

# Concurrent submissions
MAX_WORKERS=3               # Default worker count
```

### Scaling Considerations
- **Horizontal Scaling**: Multiple judge instances supported
- **Load Balancing**: Requires external load balancer
- **Resource Monitoring**: Built-in health checks

## Installation Verification

### Health Check
```bash
# Check if judge is running
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "memory": {...},
  "queue": {...}
}
```

### Docker Verification
```bash
# Check Docker access
docker ps

# Check Docker images
docker images | grep -E "(python|gcc)"
```

### Problem Verification
```bash
# List available problems
curl http://localhost:3000/problems

# Expected response
{
  "problems": ["1", "2"]
}
```

## Troubleshooting

### Common Issues

#### Node.js Version
```bash
# Check Node.js version
node --version

# If version < 18, upgrade Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Docker Permissions
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Restart Docker service
sudo systemctl restart docker

# Verify permissions
ls -la /var/run/docker.sock
```

#### Port Conflicts
```bash
# Check if port is in use
sudo netstat -tulpn | grep :3000

# Change port in environment
export PORT=3001
npm start
```

#### Memory Issues
```bash
# Check available memory
free -h

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Support

For additional support:
- Check the main README.md
- Review README-Docker.md for Docker-specific issues
- Check the logs: `docker-compose logs -f`
- Run tests: `npm test` 