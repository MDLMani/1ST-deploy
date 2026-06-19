You are a senior backend architect.

Build a production-grade backend boilerplate for a Support Ticket System using:

- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Socket.io
- Clean Architecture
- Repository Pattern
- Scalable enterprise folder structure

The backend must be ready for:
- Flutter mobile app
- React admin dashboard

Generate COMPLETE backend boilerplate code with best practices.

==================================================
PROJECT REQUIREMENTS
==================================================

Create a scalable support ticket backend where:

1. Mobile users can:
   - Register
   - Login
   - Create support tickets
   - Upload attachments
   - View their tickets
   - Receive realtime ticket updates

2. Admin can:
   - View all tickets
   - Change ticket status
   - Assign tickets
   - Reply to tickets
   - Receive overdue ticket reminders

3. System should:
   - Detect overdue complaints
   - Highlight overdue tickets
   - Trigger reminder notifications
   - Support realtime updates using Socket.io

==================================================
TECH STACK
==================================================

Use:

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT
- bcrypt
- Socket.io
- node-cron
- multer
- dotenv
- helmet
- cors
- express-rate-limit
- zod validation
- Winston logger

==================================================
ARCHITECTURE
==================================================

Use CLEAN scalable architecture.

Create this folder structure:

src/
│
├── config/
├── controllers/
├── routes/
├── services/
├── repositories/
├── middleware/
├── validators/
├── sockets/
├── jobs/
├── models/
├── interfaces/
├── types/
├── utils/
├── constants/
├── logs/
├── app.ts
└── server.ts

==================================================
FEATURES
==================================================

Implement:

AUTH:
- Register
- Login
- Refresh token
- JWT middleware
- Role middleware
- Password hashing

USER ROLES:
- user
- admin
- support_agent

TICKET SYSTEM:
- Create ticket
- Get user tickets
- Get all tickets
- Update status
- Assign tickets
- Add comments/replies
- Upload attachments

TICKET STATUS:
- OPEN
- IN_PROGRESS
- RESOLVED
- CLOSED

PRIORITY:
- LOW
- MEDIUM
- HIGH
- CRITICAL

==================================================
DATABASE MODELS
==================================================

Create Mongoose models.

USER MODEL:
- name
- email
- password
- role
- createdAt
- updatedAt

TICKET MODEL:
- ticketNumber
- user
- title
- description
- category
- priority
- status
- attachments
- assignedTo
- overdue
- reminderCount
- lastReminderAt
- createdAt
- updatedAt

COMMENT MODEL:
- ticket
- sender
- message
- createdAt

NOTIFICATION MODEL:
- user
- title
- message
- read
- createdAt

==================================================
OVERDUE REMINDER SYSTEM
==================================================

Implement node-cron job.

Logic:
- Run every hour
- Detect unresolved tickets
- HIGH priority overdue after 24h
- MEDIUM overdue after 48h
- LOW overdue after 72h
- Mark ticket overdue=true
- Send admin notification
- Emit realtime socket event

==================================================
SOCKET.IO EVENTS
==================================================

Implement realtime events:

- ticketCreated
- ticketUpdated
- ticketAssigned
- ticketOverdue
- newComment

==================================================
VALIDATION
==================================================

Use Zod validation for:
- Register
- Login
- Ticket creation
- Status updates
- Comments

==================================================
SECURITY
==================================================

Implement:
- Helmet
- CORS
- Rate limiting
- JWT auth
- Password hashing
- Environment validation

==================================================
ERROR HANDLING
==================================================

Create:
- Global error handler
- Custom ApiError class
- Async wrapper utility

==================================================
LOGGER
==================================================

Use Winston logger:
- error logs
- request logs
- cron logs

==================================================
FILE UPLOAD
==================================================

Use multer.

Support:
- image upload
- pdf upload
- local storage

==================================================
API RESPONSE FORMAT
==================================================

Use consistent response format:

{
  success: true,
  message: "",
  data: {},
  meta: {}
}

==================================================
GENERATE
==================================================

Generate:

1. Full backend setup
2. package.json
3. tsconfig.json
4. Express app setup
5. MongoDB connection
6. JWT utilities
7. Middleware
8. Controllers
9. Services
10. Repositories
11. Models
12. Validators
13. Routes
14. Socket.io setup
15. Cron jobs
16. File upload setup
17. Environment config
18. Dockerfile
19. docker-compose.yml
20. Swagger API documentation
21. README.md
22. Production-ready code

==================================================
CODING RULES
==================================================

- Use async/await
- Use TypeScript interfaces
- Use SOLID principles
- Keep controllers thin
- Put business logic in services
- Use repository pattern
- Add comments where necessary
- Write clean reusable code
- Use environment variables properly
- Use enums/constants
- Generate modular scalable code

Generate enterprise-level backend boilerplate ready for production.