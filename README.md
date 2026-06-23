# TVK Support Ticket System - Backend

Production-grade Support Ticket System backend built with Node.js, Express, TypeScript, MongoDB, JWT, and Socket.io.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (access + refresh tokens)
- **Realtime:** Socket.io
- **Validation:** Zod
- **Logging:** Winston
- **Scheduling:** node-cron
- **File Upload:** Multer

## Architecture

Clean Architecture with Repository Pattern:

```
src/
├── config/          # Environment, DB, Swagger
├── controllers/     # HTTP request handlers
├── routes/          # API route definitions
├── services/        # Business logic
├── repositories/    # Data access layer
├── middleware/      # Auth, validation, upload, errors
├── validators/      # Zod schemas
├── sockets/         # Socket.io setup
├── jobs/            # Cron jobs (overdue reminders)
├── models/          # Mongoose models
├── interfaces/      # TypeScript interfaces
├── types/           # Express type extensions
├── utils/           # Helpers (JWT, logger, errors)
├── constants/       # Enums and constants
├── app.ts           # Express app
└── server.ts        # Entry point
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 6+

### Installation

```bash
# Clone and install
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your secrets (JWT secrets must be 16+ chars)

# Development
npm run dev

# Production build
npm run build
npm start
```

### Docker

```bash
docker-compose up -d
```

API: `http://localhost:5000`  
Swagger: `http://localhost:5000/api-docs`

## Deploy to Vercel

### Prerequisites

- [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (required — local MongoDB will not work on Vercel)
- GitHub repo connected to Vercel

### Environment variables

Set these in the Vercel project dashboard (Settings → Environment Variables):

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` |
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_ACCESS_SECRET` | Yes | 16+ characters |
| `JWT_REFRESH_SECRET` | Yes | 16+ characters |
| `CORS_ORIGIN` | Yes | Comma-separated frontend URLs |
| `CRON_SECRET` | Yes | Random secret for overdue cron job |
| `VAPID_PUBLIC_KEY` | Optional | Web push |
| `VAPID_PRIVATE_KEY` | Optional | Web push |
| `SMTP_*` | Optional | Email OTP |

`SWAGGER_SERVER_URL` defaults to your Vercel URL automatically.

### Deploy

```bash
# CLI
npm i -g vercel
vercel login
vercel --prod
```

Or connect the GitHub repo in the [Vercel dashboard](https://vercel.com) and deploy.

### Verify

```bash
curl https://your-app.vercel.app/health
```

### Vercel limitations

- **Socket.io** does not run on Vercel serverless. Real-time events are disabled; use the notifications API instead.
- **File uploads** are stored on ephemeral disk and will not persist. Use S3 or Vercel Blob for production attachments.
- **Overdue reminders** run via Vercel Cron at `/api/cron/overdue` (hourly).

### Docker / traditional hosting

For full Socket.io, cron, and local file uploads, use Docker on Railway, Render, or Fly.io:

```bash
docker-compose up -d
# or
docker build -t tvkssbe . && docker run -p 5000:5000 --env-file .env tvkssbe
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh-token` | Refresh tokens |
| GET | `/api/v1/auth/profile` | Get profile (auth) |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tickets` | Create ticket (multipart) |
| GET | `/api/v1/tickets/my` | Get user's tickets |
| GET | `/api/v1/tickets/all` | Get all tickets (staff) |
| GET | `/api/v1/tickets/:id` | Get ticket by ID |
| PATCH | `/api/v1/tickets/:id/status` | Update status (staff) |
| PATCH | `/api/v1/tickets/:id/assign` | Assign ticket (staff) |
| POST | `/api/v1/tickets/:id/comments` | Add comment |
| GET | `/api/v1/tickets/:id/comments` | Get comments |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications` | Get notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| PATCH | `/api/v1/notifications/read-all` | Mark all as read |

## User Roles

- `user` - Mobile app users
- `admin` - Full admin access
- `support_agent` - Ticket management

## Socket.io Events

Connect with JWT token in `auth.token` or `Authorization` header.

| Event | Description |
|-------|-------------|
| `ticketCreated` | New ticket created |
| `ticketUpdated` | Ticket status updated |
| `ticketAssigned` | Ticket assigned to agent |
| `ticketOverdue` | Ticket marked overdue |
| `newComment` | New comment on ticket |

## Overdue Reminder System

Cron job runs every hour:
- **CRITICAL:** overdue after 12 hours
- **HIGH:** overdue after 24 hours
- **MEDIUM:** overdue after 48 hours
- **LOW:** overdue after 72 hours

## Response Format

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "meta": {}
}
```

## License

MIT
# 1ST-deploy
# 1ST-deploy
