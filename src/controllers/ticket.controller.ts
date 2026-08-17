import { Response } from 'express';
import { ticketService } from '../services/ticket.service';
import { slaService } from '../services/sla.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import {
  CreateTicketInput,
  UpdateStatusInput,
  AssignTicketInput,
  PaginationInput,
} from '../validators';
import { IAttachment } from '../interfaces';
import { getUploadDir } from '../middleware/upload.middleware';

const buildAttachments = (files: Express.Multer.File[]): IAttachment[] => {
  return files.map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: `${getUploadDir()}/${file.filename}`,
  }));
};

export const createTicket = asyncHandler(async (req, res: Response) => {
  const input = req.body as CreateTicketInput;
  const files = (req.files as Express.Multer.File[]) ?? [];
  const attachments = buildAttachments(files);

  const ticket = await ticketService.createTicket(req.user!.userId, input, attachments);
  sendSuccess(res, 'Ticket created successfully', ticket, 201);
});

export const getMyTickets = asyncHandler(async (req, res: Response) => {
  const query = req.query as unknown as PaginationInput;
  const { tickets, total } = await ticketService.getUserTickets(req.user!.userId, {
    page: query.page,
    limit: query.limit,
    status: query.status,
    overdue: query.overdue,
  });

  const limit = query.limit ?? 10;
  const page = query.page ?? 1;

  sendSuccess(res, 'Tickets retrieved', tickets, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const getAllTickets = asyncHandler(async (req, res: Response) => {
  const query = req.query as unknown as PaginationInput;
  const { tickets, total } = await ticketService.getAllTickets({
    page: query.page,
    limit: query.limit,
    status: query.status,
    overdue: query.overdue,
  });

  const limit = query.limit ?? 10;
  const page = query.page ?? 1;

  sendSuccess(res, 'All tickets retrieved', tickets, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const getTicketStats = asyncHandler(async (_req, res: Response) => {
  const stats = await ticketService.getDashboardStats();
  sendSuccess(res, 'Dashboard stats retrieved', stats);
});

export const getTicketTrends = asyncHandler(async (req, res: Response) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const granularity = req.query.granularity === 'day' ? 'day' : 'month';
  const data = await ticketService.getTrends(from, to, granularity);
  sendSuccess(res, 'Ticket trends retrieved', data);
});

export const getTicketById = asyncHandler(async (req, res: Response) => {
  const ticket = await ticketService.getTicketById(
    getRouteParam(req.params.id),
    req.user!.userId,
    req.user!.role
  );
  sendSuccess(res, 'Ticket retrieved', ticket);
});

export const updateStatus = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateStatusInput;
  const ticket = await ticketService.updateStatus(
    getRouteParam(req.params.id),
    input,
    req.user!.role
  );
  sendSuccess(res, 'Ticket status updated', ticket);
});

export const assignTicket = asyncHandler(async (req, res: Response) => {
  const input = req.body as AssignTicketInput;
  const ticket = await ticketService.assignTicket(
    getRouteParam(req.params.id),
    input,
    req.user!.role
  );
  sendSuccess(res, 'Ticket assigned successfully', ticket);
});

export const getTicketSLAStatus = asyncHandler(async (req, res: Response) => {
  const status = await slaService.getTicketSLAStatus(getRouteParam(req.params.id));
  sendSuccess(res, 'SLA status retrieved', status);
});
