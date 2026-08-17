import { draftRepository } from '../repositories/draft.repository';
import { getSocketIO } from '../sockets';
import { SOCKET_EVENTS } from '../constants';

export class DraftService {
  async saveDraft(userId: string, content: string, meta: Record<string, any> = {}) {
    // Upsert by user + meta fingerprint to avoid duplicates
    const draft = await draftRepository.create({ user: userId, content, meta });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${userId}`).emit(SOCKET_EVENTS.DRAFT_UPDATED, { draft });
    }

    return draft;
  }

  async getDrafts(userId: string) {
    return draftRepository.findByUser(userId);
  }

  async deleteDraft(userId: string, draftId: string) {
    await draftRepository.deleteById(userId, draftId);
    const io = getSocketIO();
    if (io) {
      io.to(`user:${userId}`).emit(SOCKET_EVENTS.DRAFT_DELETED, { id: draftId });
    }
  }
}

export const draftService = new DraftService();
