import { Comment, IComment } from '../models/Comment.model';

export class CommentRepository {
  async create(data: Partial<IComment>): Promise<IComment> {
    const comment = await Comment.create(data);
    return Comment.findById(comment._id)
      .populate('sender', 'name email role')
      .exec() as Promise<IComment>;
  }

  async findByTicketId(ticketId: string): Promise<IComment[]> {
    return Comment.find({ ticket: ticketId })
      .populate('sender', 'name email role')
      .sort({ createdAt: 1 })
      .exec();
  }
}

export const commentRepository = new CommentRepository();
