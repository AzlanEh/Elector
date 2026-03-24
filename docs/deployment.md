# Deployment Guide

## Overview

This guide covers deploying the Elector system to production environments. The system consists of multiple components that need to be deployed and configured properly.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ and pnpm
- PostgreSQL database
- Solana CLI and Anchor framework
- Cloud hosting accounts (AWS, Vercel, Railway, etc.)

## Environment Setup

### 1. Database

Deploy PostgreSQL database:

```bash
# Using Docker Compose
docker run -d \
  --name elector-db \
  -e POSTGRES_DB=elector \
  -e POSTGRES_USER=elector \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  postgres:15
```

Or use managed services like:
- AWS RDS
- Google Cloud SQL
- Supabase
- Railway

### 2. Solana Program

Deploy the Anchor program to Solana mainnet:

```bash
# Configure for mainnet
solana config set --url https://api.mainnet.solana.com

# Build and deploy
cd packages/solana
anchor build
anchor deploy

# Note the program ID for configuration
```

### 3. Environment Variables

Create production `.env` files:

**apps/server/.env**
```env
DATABASE_URL="postgresql://user:password@host:5432/elector"
SOLANA_RPC_URL="https://api.mainnet.solana.com"
SOLANA_PRIVATE_KEY="your-deployer-private-key"
JWT_SECRET="secure-random-secret"
NODE_ENV="production"
```

**apps/native/.env**
```env
EXPO_PUBLIC_API_URL="https://your-api-domain.com"
```

## Deployment Options

### Option 1: Vercel + Railway (Recommended)

1. **Database**: Deploy PostgreSQL on Railway
2. **API**: Deploy to Vercel
3. **Mobile**: Build and submit to app stores

### Option 2: AWS

1. **Database**: Amazon RDS PostgreSQL
2. **API**: AWS Lambda + API Gateway
3. **Mobile**: Expo Application Services

### Option 3: Docker Compose

For self-hosted deployments:

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: elector
      POSTGRES_USER: elector
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./apps/server
    environment:
      DATABASE_URL: postgresql://elector:${DB_PASSWORD}@db:5432/elector
      SOLANA_RPC_URL: https://api.mainnet.solana.com
    ports:
      - "3000:3000"
    depends_on:
      - db

volumes:
  postgres_data:
```

## Build and Deploy

### API Server

```bash
# Build
pnpm run build

# Deploy to Vercel
vercel --prod

# Or deploy Docker image
docker build -t elector-api ./apps/server
docker push your-registry/elector-api
```

### Mobile App

```bash
# Configure for production
expo build:android --type app-bundle
expo build:ios --type archive

# Submit to stores
expo submit --platform android
expo submit --platform ios
```

## Security Considerations

### 1. Key Management

- Store private keys securely (AWS KMS, HashiCorp Vault)
- Use environment variables, never commit secrets
- Rotate keys regularly

### 2. Database Security

- Use SSL connections
- Implement row-level security
- Regular backups and monitoring

### 3. API Security

- Enable CORS properly
- Implement rate limiting
- Use HTTPS everywhere
- Validate all inputs

### 4. Blockchain Security

- Verify program deployment
- Monitor for unusual activity
- Keep Anchor framework updated

## Monitoring and Maintenance

### Health Checks

- API health endpoint: `GET /healthCheck`
- Database connection monitoring
- Solana RPC connectivity

### Logging

- Structured logging with Winston
- Log aggregation (Datadog, LogRocket)
- Error tracking (Sentry)

### Performance

- Database query optimization
- API response caching
- CDN for static assets

## Scaling

### Horizontal Scaling

- Multiple API instances behind load balancer
- Read replicas for database
- Redis for session/cache storage

### Blockchain Scaling

- Monitor Solana network congestion
- Implement transaction batching
- Use priority fees for critical operations

## Backup and Recovery

### Database Backups

```bash
# Automated backups
pg_dump elector > backup.sql

# Restore
psql elector < backup.sql
```

### Disaster Recovery

- Multi-region deployment
- Automated failover
- Regular restore testing

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check connection string
   - Verify network access
   - Confirm credentials

2. **Solana Transaction Failures**
   - Check account balances
   - Verify program deployment
   - Monitor network status

3. **Mobile App Issues**
   - Check API endpoints
   - Verify app configuration
   - Test on physical devices

### Support

For production issues:
1. Check logs and monitoring
2. Review recent deployments
3. Contact the development team

## Cost Optimization

- Use reserved instances for predictable workloads
- Implement auto-scaling
- Monitor resource usage
- Optimize database queries

## Compliance

- GDPR compliance for EU users
- Data retention policies
- Audit logging for sensitive operations
- Regular security assessments