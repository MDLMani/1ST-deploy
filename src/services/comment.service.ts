import { commentRepository } from '../repositories/comment.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../constants';
import { CreateCommentInput } from '../validators';
import { getSocketIO } from '../sockets';
import { SOCKET_EVENTS } from '../constants';
import { getTicketOwnerId } from '../utils/ticket.helpers';
import { Types } from 'mongoose';

export class CommentService {
  async addComment(
    ticketId: string,
    senderId: string,
    senderRole: UserRole,
    input: CreateCommentInput
  ) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    const ticketUserId = getTicketOwnerId(ticket);
    const isOwner = ticketUserId === senderId;
    const isStaff = [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(senderRole);

    if (!isOwner && !isStaff) {
      throw new ApiError(403, 'Access denied');
    }

    const comment = await commentRepository.create({
      ticket: new Types.ObjectId(ticketId),
      sender: new Types.ObjectId(senderId),
      message: input.message,
    });

    const io = getSocketIO();
    if (io) {
      io.emit(SOCKET_EVENTS.NEW_COMMENT, { ticketId, comment });
    }

    return comment;
  }

  async getComments(ticketId: string, requesterId: string, requesterRole: UserRole) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    const ticketUserId = getTicketOwnerId(ticket);
    const isOwner = ticketUserId === requesterId;
    const isStaff = [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(requesterRole);

    if (!isOwner && !isStaff) {
      throw new ApiError(403, 'Access denied');
    }

    return commentRepository.findByTicketId(ticketId);
  }
}

export const commentService = new CommentService();
