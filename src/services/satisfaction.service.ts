import { satisfactionRepository } from '../repositories/satisfaction.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { ApiError } from '../utils/ApiError';
import { TicketStatus, SOCKET_EVENTS } from '../constants';
import { SubmitRatingInput } from '../validators';
import { getSocketIO } from '../sockets';
import { Types } from 'mongoose';

export class SatisfactionService {
  async submitRating(ticketId: string, userId: string, input: SubmitRatingInput) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new ApiError(404, 'Ticket not found');
    if (ticket.user.toString() !== userId) throw new ApiError(403, 'You can only rate your own tickets');
    if (![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status as TicketStatus)) {
      throw new ApiError(400, 'Can only rate resolved or closed tickets');
    }
    const existing = await satisfactionRepository.findByTicketId(ticketId);
    if (existing) throw new ApiError(409, 'You have already rated this ticket');
    const rating = await satisfactionRepository.submitRating({
      ticket: new Types.ObjectId(ticketId),
      user: new Types.ObjectId(userId),
      rating: input.rating,
      comment: input.comment,
    });
    const io = getSocketIO();
    if (io) io.emit(SOCKET_EVENTS.SATISFACTION_SUBMITTED, { ticketId, rating: input.rating });
    return rating;
  }

  async getTicketRating(ticketId: string) {
    return satisfactionRepository.findByTicketId(ticketId);
  }

  async getCSATStats() {
    return satisfactionRepository.getCSATStats();
  }
}

export const satisfactionService = new SatisfactionService();
