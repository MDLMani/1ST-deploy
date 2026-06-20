import { Router } from 'express';
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketStats,
  getTicketById,
  updateStatus,
  assignTicket,
} from '../controllers/ticket.controller';
import { addComment, getComments } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadAttachments } from '../middleware/upload.middleware';
import {
  createTicketSchema,
  updateStatusSchema,
  assignTicketSchema,
  createCommentSchema,
  paginationSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/tickets:
 *   post:
 *     tags: [Tickets]
 *     summary: Create a support ticket
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               attachments: { type: array, items: { type: string, format: binary } }
 *     responses:
 *       201:
 *         description: Ticket created
 */
router.post('/', uploadAttachments, validate(createTicketSchema), createTicket);

/**
 * @swagger
 * /api/v1/tickets/my:
 *   get:
 *     tags: [Tickets]
 *     summary: Get current user's tickets
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: overdue
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: User tickets retrieved
 */
router.get('/my', validate(paginationSchema, 'query'), getMyTickets);

/**
 * @swagger
 * /api/v1/tickets/all:
 *   get:
 *     tags: [Tickets]
 *     summary: Get all tickets (staff only)
 *     responses:
 *       200:
 *         description: All tickets retrieved
 */
router.get('/all', staffOnly, validate(paginationSchema, 'query'), getAllTickets);

/**
 * @swagger
 * /api/v1/tickets/stats:
 *   get:
 *     tags: [Tickets]
 *     summary: Dashboard stats (staff only)
 *     responses:
 *       200:
 *         description: Aggregated ticket metrics
 */
router.get('/stats', staffOnly, getTicketStats);

/**
 * @swagger
 * /api/v1/tickets/{id}:
 *   get:
 *     tags: [Tickets]
 *     summary: Get ticket by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket retrieved
 */
router.get('/:id', getTicketById);

/**
 * @swagger
 * /api/v1/tickets/{id}/status:
 *   patch:
 *     tags: [Tickets]
 *     summary: Update ticket status (staff only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED] }
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', staffOnly, validate(updateStatusSchema), updateStatus);

/**
 * @swagger
 * /api/v1/tickets/{id}/assign:
 *   patch:
 *     tags: [Tickets]
 *     summary: Assign ticket to staff (staff only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedTo: { type: string }
 *     responses:
 *       200:
 *         description: Ticket assigned
 */
router.patch('/:id/assign', staffOnly, validate(assignTicketSchema), assignTicket);

/**
 * @swagger
 * /api/v1/tickets/{id}/comments:
 *   post:
 *     tags: [Comments]
 *     summary: Add comment to ticket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Comment added
 */
router.post('/:id/comments', validate(createCommentSchema), addComment);

/**
 * @swagger
 * /api/v1/tickets/{id}/comments:
 *   get:
 *     tags: [Comments]
 *     summary: Get ticket comments
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comments retrieved
 */
router.get('/:id/comments', getComments);

export default router;
