# StreamHive Upload Service

A Node.js microservice for handling video uploads in the StreamHive platform.

## Features

- ✅ Video file upload (MP4, MOV, AVI, WebM)
- 🔐 JWT-based authentication
- 📁 Azure Blob Storage integration
- 🔄 RabbitMQ message queue (topic exchange) for transcoding pipeline
- 📊 Metadata extraction and validation
- 🛡️ Rate limiting and security headers
- 📝 Comprehensive logging
- 🐳 Docker support

## Quick Start

### Prerequisites

- Node.js 18+
- Azure Storage Account or Azurite Emulator
- RabbitMQ
- FFmpeg (for metadata extraction)

### Installation

```bash
npm install
```

### Environment Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration.

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Docker

```bash
npm run docker:build
npm run docker:run
```

## API Endpoints

### Upload Video

```http
POST /api/v1/upload
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

{
  "video": <file>,
  "title": "My Video",
  "description": "Video description",
  "tags": "tag1,tag2,tag3",
  "isPrivate": false
}
```

### Get Upload Status

```http
GET /api/v1/upload/:uploadId/status
Authorization: Bearer <jwt_token>
```

### Health Check

```http
GET /health
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │────│  Upload Service │────│ Azure Blob Store│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   RabbitMQ      │ (topic exchange 'streamhive')
                       └─────────────────┘
                              │ routing key: video.uploaded
                              ▼
                     ┌────────────────────┐
                     │  TranscoderService │ (publishes video.transcoded)
                     └────────────────────┘
                              │ routing key: video.transcoded
                              ▼
                     ┌────────────────────┐
                     │ VideoCatalogService│
                     └────────────────────┘
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment | No | development |
| `JWT_SECRET` | JWT secret key | Yes | - |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Storage connection string | Yes | - |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure Storage account name | No | - |
| `AZURE_STORAGE_ACCOUNT_KEY` | Azure Storage account key | No | - |
| `AZURE_STORAGE_RAW_CONTAINER` | Container for raw videos | Yes | streamhive-raw-videos |
| `AZURE_STORAGE_PROCESSED_CONTAINER` | Container for processed videos | Yes | streamhive-processed-videos |
| `RABBITMQ_URL` | RabbitMQ connection URL | Yes | - |
| `AMQP_EXCHANGE` | Topic exchange for events | No | streamhive |
| `AMQP_UPLOAD_ROUTING_KEY` | Routing key for upload events | No | video.uploaded |
| `MAX_FILE_SIZE` | Max upload size (bytes) | No | 1073741824 |
| `ALLOWED_FORMATS` | Allowed video formats | No | mp4,mov,avi,webm |

## License

MIT
