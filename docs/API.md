# API Documentation - StreamHive Upload Service

## Base URL
```
Development: http://localhost:3001
Production: https://api.streamhive.com/upload
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Upload Video

**POST** `/api/v1/upload`

Upload a video file for processing.

#### Headers
- `Authorization: Bearer <jwt_token>`
- `Content-Type: multipart/form-data`

#### Request Body (FormData)
- `video` (file, required): Video file (MP4, MOV, AVI, WebM)
- `title` (string, required): Video title (max 255 chars)
- `description` (string, optional): Video description (max 5000 chars)
- `tags` (string, optional): Comma-separated tags (max 500 chars)
- `isPrivate` (boolean, optional): Whether video is private (default: false)
- `category` (string, optional): Video category (default: 'other')

#### Response
```json
{
  "success": true,
  "message": "Video upload initiated successfully",
  "data": {
    "uploadId": "123e4567-e89b-12d3-a456-426614174000",
    "status": "processing",
    "estimatedProcessingTime": 120
  }
}
```

#### Example cURL
```bash
curl -X POST http://localhost:3001/api/v1/upload \
  -H "Authorization: Bearer your_jwt_token" \
  -F "video=@example.mp4" \
  -F "title=My Amazing Video" \
  -F "description=This is a test video" \
  -F "tags=test,sample,demo" \
  -F "isPrivate=false" \
  -F "category=entertainment"
```

### 2. Get Upload Status

**GET** `/api/v1/upload/:uploadId/status`

Get the current status of an upload.

#### Headers
- `Authorization: Bearer <jwt_token>`

#### Path Parameters
- `uploadId` (string): The upload ID returned from the upload endpoint

#### Response
```json
{
  "success": true,
  "data": {
    "uploadId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "user123",
    "status": "transcoding",
    "progress": 75,
    "createdAt": "2025-08-08T10:30:00Z",
    "updatedAt": "2025-08-08T10:35:00Z",
    "metadata": {
      "duration": 300,
      "width": 1920,
      "height": 1080,
      "fileSize": 52428800,
      "format": "mp4"
    }
  }
}
```

#### Upload Status Values
- `uploading`: File is being uploaded
- `uploaded`: File upload completed
- `queued_for_transcoding`: Waiting in transcode queue
- `transcoding`: Video is being processed
- `completed`: Processing completed successfully
- `failed`: Processing failed

### 3. Get User's Uploads

**GET** `/api/v1/upload/my-uploads`

Get a list of uploads for the authenticated user.

#### Headers
- `Authorization: Bearer <jwt_token>`

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (max: 50, default: 10)
- `status` (string, optional): Filter by status

#### Response
```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "uploadId": "123e4567-e89b-12d3-a456-426614174000",
        "title": "My Video",
        "status": "completed",
        "createdAt": "2025-08-08T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 4. Health Check

**GET** `/health`

Get service health status.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2025-08-08T10:30:00Z",
  "service": "streamhive-upload-service",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600,
  "dependencies": {
    "minio": "healthy",
    "rabbitmq": "healthy"
  },
  "memory": {
    "rss": "128 MB",
    "heapTotal": "64 MB",
    "heapUsed": "32 MB",
    "external": "8 MB"
  }
}
```

### 5. Readiness Probe

**GET** `/health/ready`

Check if service is ready to accept requests.

### 6. Liveness Probe

**GET** `/health/live`

Check if service is alive.

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "Title is required",
    "File must be a video"
  ]
}
```

### Authentication Error (401)
```json
{
  "success": false,
  "error": "Access token required"
}
```

### Authorization Error (403)
```json
{
  "success": false,
  "error": "Insufficient permissions for upload"
}
```

### File Too Large (413)
```json
{
  "success": false,
  "error": "File too large"
}
```

### Rate Limit Exceeded (429)
```json
{
  "success": false,
  "error": "Too many upload requests, please try again later"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Rate Limits
- 50 upload requests per 15 minutes per IP address
- Maximum file size: 1GB
- Supported formats: MP4, MOV, AVI, WebM

## File Processing Pipeline
1. **Upload**: File uploaded to temporary storage
2. **Validation**: File format and metadata validation
3. **Storage**: Raw file stored in MinIO/S3
4. **Queue**: Transcode job added to RabbitMQ
5. **Processing**: Video transcoded to multiple resolutions
6. **Completion**: Processed files available for streaming
