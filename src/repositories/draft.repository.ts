import { Draft, IDraft } from '../models/Draft.model';

export class DraftRepository {
  async upsertByUserAndMeta(userId: string, meta: Record<string, any>, content: string): Promise<IDraft> {
    return Draft.findOneAndUpdate(
      { user: userId, meta },
      { user: userId, meta, content },
      { upsert: true, new: true }
    ).exec() as Promise<IDraft>;
  }

  async create(data: Partial<IDraft>): Promise<IDraft> {
    return Draft.create(data as any);
  }

  async findByUser(userId: string) {
    return Draft.find({ user: userId }).sort({ updatedAt: -1 }).exec();
  }

  async findById(id: string) {
    return Draft.findById(id).exec();
  }

  async deleteById(userId: string, id: string) {
    await Draft.deleteOne({ _id: id, user: userId }).exec();
  }
}

export const draftRepository = new DraftRepository();
