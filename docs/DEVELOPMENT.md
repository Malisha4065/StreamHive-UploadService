# StreamHive Upload Service - Development Guide

## Architecture Overview

The Upload Service is a critical component of the StreamHive platform responsible for:
- Handling video file uploads
- Validating and extracting metadata
- Storing raw videos in object storage
- Queuing transcode jobs for processing

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │────│  Upload Service │────│     MinIO       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                       ┌─────────────────┐
                       │    RabbitMQ     │
                       │ (Transcode Queue)│
                       └─────────────────┘
```

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── minio.js     # MinIO client setup
│   └── rabbitmq.js  # RabbitMQ connection
├── middleware/       # Express middleware
│   ├── auth.js      # JWT authentication
│   ├── upload.js    # Multer file upload
│   ├── validation.js # Request validation
│   └── errorHandler.js
├── routes/          # API routes
│   ├── upload.js    # Upload endpoints
│   └── health.js    # Health check endpoints
├── services/        # Business logic
│   └── uploadService.js
├── utils/           # Utility functions
│   ├── logger.js    # Winston logger
│   └── videoUtils.js # Video processing utilities
└── server.js        # Express app entry point
```

## Key Components

### 1. Authentication Middleware
- Validates JWT tokens
- Checks user permissions
- Located in `src/middleware/auth.js`

### 2. File Upload Handling
- Uses Multer for multipart/form-data
- Memory storage for processing
- File type validation
- Size limits enforcement

### 3. Video Processing
- FFmpeg integration for metadata extraction
- Format validation
- Thumbnail generation (planned)

### 4. Storage Integration
- MinIO client for object storage
- Bucket management
- Presigned URLs for secure access

### 5. Message Queue
- RabbitMQ for async processing
- Durable queues for reliability
- Dead letter queues (planned)

## Environment Configuration

### Required Variables
```bash
# Server
PORT=3001
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key

# Storage
MINIO_ENDPOINT=localhost
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=streamhive-videos

# Message Queue
RABBITMQ_URL=amqp://localhost:5672
TRANSCODE_QUEUE=video_transcode_queue

# Upload Limits
MAX_FILE_SIZE=1073741824  # 1GB
ALLOWED_FORMATS=mp4,mov,avi,webm
```

## Development Workflow

### 1. Setup Development Environment
```bash
# Run setup script
./scripts/setup.sh

# Or manually:
npm install
cp .env.example .env
docker-compose up -d minio rabbitmq
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Run Tests
```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

### 4. Code Quality
```bash
npm run lint       # ESLint
npm run lint:fix   # Auto-fix issues
```

## Testing Strategy

### Unit Tests
- Validation middleware
- Utility functions
- Service methods

### Integration Tests
- API endpoints
- Database interactions
- External service mocking

### Load Testing
```bash
# Use provided load test script
JWT_TOKEN=your_token ./scripts/load-test.sh
```

## Error Handling

### Error Categories
1. **Validation Errors**: Invalid input data
2. **Authentication Errors**: Missing/invalid tokens
3. **Storage Errors**: MinIO/S3 issues
4. **Queue Errors**: RabbitMQ problems
5. **Processing Errors**: FFmpeg failures

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": ["Additional error details"]
}
```

## Security Considerations

### 1. File Upload Security
- MIME type validation
- File extension checking
- Content scanning (planned)
- Size limits

### 2. Authentication
- JWT token validation
- Permission-based access
- Rate limiting

### 3. Storage Security
- Presigned URLs for temporary access
- Bucket policies for public content
- Encryption at rest (planned)

## Performance Optimization

### 1. Upload Performance
- Streaming uploads to reduce memory usage
- Parallel processing where possible
- Connection pooling

### 2. Storage Optimization
- Efficient bucket organization
- CDN integration (planned)
- Cleanup of failed uploads

### 3. Queue Management
- Message acknowledgments
- Retry mechanisms
- Dead letter queues

## Monitoring and Observability

### Health Checks
- `/health` - Overall service health
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe

### Logging
- Structured JSON logging
- Log levels: error, warn, info, debug
- Request correlation IDs (planned)

### Metrics (Planned)
- Upload success/failure rates
- Processing times
- Queue depths
- Storage usage

## Deployment

### Docker
```bash
docker build -t streamhive-upload-service .
docker run -p 3001:3001 streamhive-upload-service
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

### CI/CD
- GitHub Actions workflow
- Automated testing
- Docker image building
- Kubernetes deployment

## Troubleshooting

### Common Issues

1. **MinIO Connection Failed**
   - Check endpoint and credentials
   - Verify bucket exists
   - Check network connectivity

2. **RabbitMQ Queue Issues**
   - Verify connection URL
   - Check queue exists
   - Monitor queue depth

3. **Upload Failures**
   - Check file size limits
   - Verify file format support
   - Review authentication

4. **Memory Issues**
   - Monitor heap usage
   - Optimize buffer handling
   - Consider streaming uploads

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Run linting before commits

## Future Enhancements

- [ ] Multipart upload for large files
- [ ] Resume interrupted uploads
- [ ] Content virus scanning
- [ ] Advanced video analysis
- [ ] Real-time upload progress
- [ ] Webhook notifications
