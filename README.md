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
```

Default admin (created on startup):

- **Email:** `tvksuppourt@gmail.com`
- **Password:** `tvksuppourt`

```bash
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

## Deploy (Vercel)

Release apps already call `https://tvkssbe.vercel.app/api/v1`. Socket.IO is not available on Vercel serverless.

1. Create an Atlas database (do not use `MONGODB_URI=memory`).
2. Seed locations once against Atlas: `MONGODB_URI="mongodb+srv://..." npm run seed:tn-locations`
3. In the Vercel project, set at least:

```
NODE_ENV=production
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
CRON_SECRET=
CORS_ORIGIN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
INVITE_ACCEPT_URL=https://tvkssbe.vercel.app/api/v1/user-management/invitations/accept
SWAGGER_SERVER_URL=https://tvkssbe.vercel.app
```

JWT secrets must not be the `.env.example` placeholders. `CRON_SECRET` is required for the daily overdue / SLA / escalation job.

Ticket photo uploads on Vercel are stored in `/tmp` and do not persist across instances. Use a long-running host (Docker / VPS) if attachments must be durable.

4. Deploy from this repo (`vercel --prod` or Git integration).

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

Cron job runs every hour on Docker/traditional hosting (daily on Vercel Hobby):
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
