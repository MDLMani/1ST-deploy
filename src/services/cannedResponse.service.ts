import { cannedResponseRepository } from '../repositories/cannedResponse.repository';
import { ApiError } from '../utils/ApiError';
import { CannedResponseInput, UpdateCannedResponseInput } from '../validators';
import { Types } from 'mongoose';

export class CannedResponseService {
  async createCannedResponse(input: CannedResponseInput, userId: string) {
    return cannedResponseRepository.create({
      ...input,
      createdBy: new Types.ObjectId(userId),
      department: input.department ? new Types.ObjectId(input.department) : undefined,
    });
  }

  async getCannedResponses(userId: string, page?: number, limit?: number, category?: string, search?: string) {
    return cannedResponseRepository.findByUser(userId, { page, limit, category, search });
  }

  async lookupByShortcut(shortcut: string, userId: string) {
    const response = await cannedResponseRepository.findByShortcut(shortcut, userId);
    if (!response) throw new ApiError(404, 'Canned response not found');
    await cannedResponseRepository.incrementUsage(response._id.toString());
    return response;
  }

  async updateCannedResponse(id: string, input: UpdateCannedResponseInput, userId: string) {
    const response = await cannedResponseRepository.findById(id);
    if (!response) throw new ApiError(404, 'Canned response not found');
    if (response.createdBy.toString() !== userId) throw new ApiError(403, 'You can only edit your own canned responses');
    const updated = await cannedResponseRepository.updateById(id, input);
    if (!updated) throw new ApiError(404, 'Canned response not found');
    return updated;
  }

  async deleteCannedResponse(id: string, userId: string) {
    const response = await cannedResponseRepository.findById(id);
    if (!response) throw new ApiError(404, 'Canned response not found');
    if (response.createdBy.toString() !== userId) throw new ApiError(403, 'You can only delete your own canned responses');
    const deleted = await cannedResponseRepository.deleteById(id);
    if (!deleted) throw new ApiError(404, 'Canned response not found');
    return { message: 'Canned response deleted successfully' };
  }
}

export const cannedResponseService = new CannedResponseService();
