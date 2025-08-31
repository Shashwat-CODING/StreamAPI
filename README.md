# Docker Guide for VideoTube

This guide explains how to run VideoTube using Docker and Docker Compose for both development and production environments.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0+)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

#### Development Mode
```bash
# Start development environment with hot reload
docker-compose --profile dev up --build

# Access the application at http://localhost:5000
```

#### Production Mode
```bash
# Start production environment
docker-compose --profile prod up --build -d

# Access the application at http://localhost:5000
```

#### Custom Port
```bash
# Start on port 3000 instead of 5000
docker-compose --profile custom up --build -d

# Access the application at http://localhost:3000
```

### Option 2: Using Docker Directly

#### Build the Image
```bash
# Build development image
docker build --target development -t flux-tube:dev .

# Build production image
docker build --target production -t flux-tube:prod .
```

#### Run the Container

##### Development
```bash
docker run -p 5000:5000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  -e NODE_ENV=development \
  flux-tube:dev
```

##### Production
```bash
docker run -p 5000:5000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  flux-tube:prod
```

## Docker Compose Profiles

### Development Profile (`--profile dev`)
- **Hot Reload**: Code changes are reflected immediately
- **Volume Mounting**: Source code is mounted for live editing
- **Development Dependencies**: All npm packages installed
- **Port**: 5000

### Production Profile (`--profile prod`)
- **Optimized Build**: Production-optimized image
- **Security**: Runs as non-root user
- **Health Checks**: Automatic health monitoring
- **Restart Policy**: Automatic restart on failure
- **Port**: 5000

### Custom Profile (`--profile custom`)
- **Custom Port**: Runs on port 3000 instead of 5000
- **Production Optimized**: Same as production profile
- **Useful for**: Multiple instances or port conflicts

## Environment Variables

You can customize the application behavior using environment variables:

```bash
# Create a .env file
NODE_ENV=production
PORT=5000
```

### Available Variables
- `NODE_ENV`: Environment mode (development/production)
- `PORT`: Application port (default: 5000)

## Docker Commands Reference

### Building Images
```bash
# Build all stages
docker build -t flux-tube .

# Build specific stage
docker build --target development -t flux-tube:dev .
docker build --target production -t flux-tube:prod .

# Build with no cache
docker build --no-cache -t flux-tube .
```

### Running Containers
```bash
# Run in foreground
docker run -p 5000:5000 flux-tube:prod

# Run in background
docker run -d -p 5000:5000 --name flux-tube flux-tube:prod

# Run with custom environment
docker run -p 5000:5000 -e NODE_ENV=development flux-tube:dev

# Run with volume mounting
docker run -p 5000:5000 -v $(pwd):/app flux-tube:dev
```

### Managing Containers
```bash
# List running containers
docker ps

# Stop container
docker stop flux-tube

# Remove container
docker rm flux-tube

# View logs
docker logs flux-tube

# Follow logs
docker logs -f flux-tube

# Execute commands in container
docker exec -it flux-tube sh
```

### Docker Compose Commands
```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Start specific profile
docker-compose --profile prod up -d

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Scale services
docker-compose up --scale flux-tube-prod=3
```

## Multi-Stage Build Benefits

The Dockerfile uses multi-stage builds for optimization:

### Base Stage
- **Node.js 20 Alpine**: Lightweight base image
- **Dependencies**: Production dependencies only
- **Caching**: Optimized layer caching

### Development Stage
- **Full Dependencies**: All npm packages
- **Source Code**: Complete application code
- **Hot Reload**: Volume mounting support

### Production Stage
- **Security**: Non-root user execution
- **Health Checks**: Application monitoring
- **Optimized**: Minimal image size

## Health Checks

The production container includes health checks:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' flux-tube

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' flux-tube
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 5000
lsof -i :5000

# Use different port
docker run -p 3000:5000 flux-tube:prod
```

#### Permission Issues
```bash
# Fix volume permissions
docker run -p 5000:5000 -v $(pwd):/app:delegated flux-tube:dev
```

#### Build Failures
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t flux-tube .
```

#### Container Won't Start
```bash
# Check container logs
docker logs flux-tube

# Run with interactive shell
docker run -it --rm flux-tube:prod sh
```

### Debugging

#### Access Container Shell
```bash
# Development container
docker exec -it flux-tube-dev sh

# Production container
docker exec -it flux-tube-prod sh
```

#### View Application Logs
```bash
# Docker logs
docker logs flux-tube

# Application logs inside container
docker exec flux-tube cat /app/logs/app.log
```

#### Check Network Connectivity
```bash
# Test API endpoint
curl http://localhost:5000/api/v1/search/hello/1

# Test from inside container
docker exec flux-tube wget -qO- http://localhost:5000/
```

## Production Deployment

### Using Docker Compose
```bash
# Production deployment
docker-compose --profile prod up -d

# With custom environment
NODE_ENV=production docker-compose --profile prod up -d
```

### Using Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml flux-tube

# Scale service
docker service scale flux-tube_flux-tube-prod=3
```

### Using Kubernetes
```bash
# Apply deployment
kubectl apply -f k8s-deployment.yaml

# Check status
kubectl get pods
kubectl logs deployment/flux-tube
```

## Performance Optimization

### Image Size
- **Alpine Linux**: Minimal base image
- **Multi-stage Build**: Separate dev/prod stages
- **Layer Caching**: Optimized dependency installation

### Runtime Performance
- **Non-root User**: Security best practices
- **Health Checks**: Automatic monitoring
- **Restart Policy**: High availability

### Resource Limits
```bash
# Set memory and CPU limits
docker run -p 5000:5000 \
  --memory=512m \
  --cpus=1.0 \
  flux-tube:prod
```

## Security Considerations

### Container Security
- **Non-root User**: Application runs as `nodejs` user
- **Minimal Base Image**: Alpine Linux reduces attack surface
- **No Development Tools**: Production image excludes dev dependencies

### Network Security
- **Port Exposure**: Only necessary ports exposed
- **Internal Communication**: Services communicate internally
- **Health Checks**: Monitor application health

## Monitoring and Logging

### Health Monitoring
```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Monitor resource usage
docker stats flux-tube
```

### Log Management
```bash
# View application logs
docker logs flux-tube

# Follow logs in real-time
docker logs -f flux-tube

# Export logs
docker logs flux-tube > app.log
```

## Backup and Recovery

### Data Backup
```bash
# Backup application data
docker run --rm -v flux-tube_data:/data -v $(pwd):/backup alpine tar czf /backup/app-data.tar.gz -C /data .
```

### Image Backup
```bash
# Save image to file
docker save flux-tube:prod > flux-tube-prod.tar

# Load image from file
docker load < flux-tube-prod.tar
```

## Support

For issues and questions:
- Check the troubleshooting section
- Review container logs
- Ensure Docker and Docker Compose are properly installed
- Verify system requirements are met

---

**Note**: This Docker setup is optimized for both development and production use. Always test thoroughly in a staging environment before deploying to production.
