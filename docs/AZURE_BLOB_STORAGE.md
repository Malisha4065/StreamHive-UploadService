# Azure Blob Storage Integration Guide

## Overview

The StreamHive Upload Service uses Azure Blob Storage as the primary storage backend for video files. This provides enterprise-grade scalability, security, and global distribution capabilities.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Upload API    │────│  Upload Service │────│ Azure Blob Store│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │    RabbitMQ     │    │   Azure CDN     │
                       │ (Transcode Queue)│    │  (Optional)     │
                       └─────────────────┘    └─────────────────┘
```

## Container Structure

### Raw Videos Container
- **Name**: `streamhive-raw-videos`
- **Access Level**: Private
- **Purpose**: Store original uploaded videos
- **Lifecycle**: Files moved to cold storage after processing

### Processed Videos Container
- **Name**: `streamhive-processed-videos`
- **Access Level**: Public (for streaming)
- **Purpose**: Store transcoded video chunks and manifests
- **CDN**: Integrated with Azure CDN for global distribution

## Configuration

### Connection Methods

#### Method 1: Connection String (Recommended)
```bash
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey;EndpointSuffix=core.windows.net"
```

#### Method 2: Account Name + Key
```bash
AZURE_STORAGE_ACCOUNT_NAME="mystreamhiveaccount"
AZURE_STORAGE_ACCOUNT_KEY="your_account_key_here"
```

#### Method 3: Managed Identity (Production)
```bash
# No explicit credentials needed - uses Azure Managed Identity
AZURE_STORAGE_ACCOUNT_NAME="mystreamhiveaccount"
```

### Container Configuration
```bash
AZURE_STORAGE_RAW_CONTAINER="streamhive-raw-videos"
AZURE_STORAGE_PROCESSED_CONTAINER="streamhive-processed-videos"
```

## Development Setup

### Using Azurite Emulator

For local development, use the Azurite emulator:

```bash
# Using Docker
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 \
  mcr.microsoft.com/azure-storage/azurite

# Or install globally
npm install -g azurite
azurite --silent --location /tmp/azurite --debug /tmp/azurite/debug.log
```

### Local Configuration
```bash
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
```

## Storage Features

### Blob Metadata
Each uploaded video includes comprehensive metadata:

```javascript
{
  'upload-id': 'uuid-v4',
  'user-id': 'user-identifier',
  'original-filename': 'original-file-name.mp4',
  'title': 'Video Title',
  'description': 'Video Description',
  'tags': 'comma,separated,tags',
  'is-private': 'true/false',
  'category': 'entertainment',
  'duration': 'seconds',
  'width': 'pixels',
  'height': 'pixels',
  'bitrate': 'bits-per-second'
}
```

### Blob Naming Convention
```
Raw Videos:    raw/{userId}/{uploadId}.{extension}
Processed:     processed/{uploadId}/{resolution}/
Thumbnails:    thumbnails/{uploadId}/
Subtitles:     subtitles/{uploadId}/
```

### Secure Access Patterns

#### SAS (Shared Access Signature) URLs
Generated for temporary, secure access:

```javascript
// Read-only access for 24 hours
const sasUrl = generateSASUrl(
  containerName, 
  blobName, 
  'r',  // read permission
  24    // 24 hours
)
```

#### Access Policies
- **Raw Container**: Private access only
- **Processed Container**: Public read for streaming
- **Admin Operations**: Full access via service principal

## Performance Optimization

### Upload Performance
1. **Multipart Upload**: For files > 256MB
2. **Parallel Upload**: Concurrent block uploads
3. **Compression**: Client-side compression for faster uploads

### Storage Tiers
- **Hot**: Recently uploaded, frequently accessed
- **Cool**: Older content, less frequent access
- **Archive**: Long-term storage, rare access

### CDN Integration
```javascript
// Azure CDN endpoint
const cdnUrl = `https://streamhive.azureedge.net/${blobPath}`
```

## Security

### Network Security
- **Private Endpoints**: VNet integration
- **Firewall Rules**: IP whitelisting
- **HTTPS Only**: Enforce encrypted connections

### Access Control
- **RBAC**: Role-based access control
- **Service Principal**: Application authentication
- **Managed Identity**: Azure resource authentication

### Data Protection
- **Encryption at Rest**: AES-256 encryption
- **Encryption in Transit**: HTTPS/TLS
- **Customer-Managed Keys**: Advanced encryption

## Monitoring and Alerts

### Key Metrics
- Upload success/failure rates
- Storage usage and costs
- Request latency and throughput
- Bandwidth consumption

### Azure Monitor Integration
```javascript
// Application Insights telemetry
const appInsights = require('applicationinsights')
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
```

### Alerts Configuration
- High error rates (>5%)
- Unusual traffic patterns
- Storage quota approaching limits
- Cost threshold breaches

## Cost Optimization

### Storage Optimization
1. **Lifecycle Policies**: Automatic tier transitions
2. **Redundancy Options**: Choose appropriate replication
3. **Cleanup Jobs**: Remove failed/orphaned uploads

### Bandwidth Optimization
1. **CDN Usage**: Reduce egress costs
2. **Compression**: Smaller file transfers
3. **Regional Deployment**: Data locality

## Disaster Recovery

### Backup Strategy
- **Cross-Region Replication**: Automatic failover
- **Point-in-Time Recovery**: Restore capabilities
- **Immutable Storage**: Protection against deletion

### Recovery Procedures
1. **Region Failover**: Automatic DNS updates
2. **Data Restoration**: From backup storage
3. **Service Recovery**: Container orchestration

## Compliance

### Data Residency
- **Regional Storage**: Data sovereignty compliance
- **Data Classification**: Sensitive data handling
- **Audit Trails**: Complete access logging

### Standards Compliance
- **SOC 2**: Security and availability
- **ISO 27001**: Information security
- **GDPR**: Data protection regulations

## Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Test connectivity
az storage blob list --account-name myaccount --container-name test
```

#### Permission Errors
```bash
# Check RBAC assignments
az role assignment list --assignee <service-principal-id>
```

#### Performance Issues
- Monitor request patterns
- Check throttling limits
- Analyze bandwidth usage

### Debug Commands
```bash
# Enable debug logging
DEBUG=azure* npm start

# Check container permissions
az storage container show-permission --name mycontainer
```

## Migration from MinIO

### Migration Steps
1. **Data Export**: Download from MinIO
2. **Format Conversion**: Adjust metadata format
3. **Bulk Upload**: Transfer to Azure Blob
4. **Validation**: Verify data integrity
5. **Switch Configuration**: Update environment variables

### Migration Script
```javascript
// Provided in scripts/migrate-from-minio.js
const migrationTool = require('./scripts/migrate-from-minio')
await migrationTool.migrate()
```

## Best Practices

### Development
- Use Azurite for local testing
- Implement retry logic for transient failures
- Cache metadata to reduce API calls

### Production
- Enable diagnostic logging
- Implement circuit breakers
- Use managed identities for authentication
- Monitor costs and set budgets

### Security
- Rotate access keys regularly
- Use least privilege principles
- Enable advanced threat protection
- Implement network restrictions
