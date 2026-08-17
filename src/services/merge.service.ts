import { ticketRepository } from '../repositories/ticket.repository';
import { commentRepository } from '../repositories/comment.repository';
import { ApiError } from '../utils/ApiError';
import { TicketStatus, SOCKET_EVENTS, UserRole } from '../constants';
import { MergeTicketsInput, LinkRelatedInput } from '../validators';
import { getSocketIO } from '../sockets';
import { Types } from 'mongoose';

export class MergeService {
  async mergeTickets(input: MergeTicketsInput, userId: string, userRole: UserRole) {
    const target = await ticketRepository.findById(input.targetId);
    if (!target) throw new ApiError(404, 'Target ticket not found');

    const sourceTickets = [];
    for (const sourceId of input.sourceIds) {
      if (sourceId === input.targetId) throw new ApiError(400, 'Cannot merge a ticket into itself');
      const source = await ticketRepository.findById(sourceId);
      if (!source) throw new ApiError(404, `Source ticket ${sourceId} not found`);
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPPORT_AGENT) {
        if (source.user.toString() !== userId || target.user.toString() !== userId) {
          throw new ApiError(403, 'You can only merge your own tickets');
        }
      }
      sourceTickets.push(source);
    }

    // Merge comments from source to target
    for (const source of sourceTickets) {
      const comments = await commentRepository.findByTicketId(source._id.toString());
      for (const comment of comments) {
        await commentRepository.create({
          ticket: target._id,
          sender: comment.sender,
          message: `[Merged from ${source.ticketNumber}] ${comment.message}`,
          isInternal: comment.isInternal,
        });
      }

      // Mark source as merged
      await ticketRepository.updateById(source._id.toString(), {
        status: TicketStatus.MERGED,
        mergedInto: target._id,
      });
    }

    // Add source tickets as related
    const sourceIds = sourceTickets.map((s) => s._id);
    await ticketRepository.updateById(input.targetId, {
      $addToSet: { relatedTickets: { $each: sourceIds } },
    });

    const io = getSocketIO();
    if (io) {
      const updated = await ticketRepository.findById(input.targetId);
      io.emit(SOCKET_EVENTS.TICKET_MERGED, { target: updated, mergedCount: sourceTickets.length });
    }

    return { message: `Successfully merged ${sourceTickets.length} tickets into ${target.ticketNumber}` };
  }

  async linkRelatedTickets(ticketId: string, input: LinkRelatedInput) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new ApiError(404, 'Ticket not found');
    for (const relatedId of input.relatedIds) {
      if (relatedId === ticketId) throw new ApiError(400, 'Cannot link a ticket to itself');
      const related = await ticketRepository.findById(relatedId);
      if (!related) throw new ApiError(404, `Related ticket ${relatedId} not found`);
    }
    await ticketRepository.updateById(ticketId, {
      $addToSet: { relatedTickets: { $each: input.relatedIds.map((id) => new Types.ObjectId(id)) } },
    });
    return { message: 'Related tickets linked successfully' };
  }

  async unlinkRelatedTicket(ticketId: string, relatedId: string) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new ApiError(404, 'Ticket not found');
    await ticketRepository.updateById(ticketId, {
      $pull: { relatedTickets: new Types.ObjectId(relatedId) },
    });
    return { message: 'Related ticket unlinked successfully' };
  }
}

export const mergeService = new MergeService();
