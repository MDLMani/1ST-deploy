import { tagRepository } from '../repositories/tag.repository';
import { Tag } from '../models/Tag.model';
import { ApiError } from '../utils/ApiError';
import { TagInput, UpdateTagInput } from '../validators';
import { Types } from 'mongoose';

export class TagService {
  async createTag(input: TagInput, userId: string) {
    const existing = await tagRepository.findByName(input.name);
    if (existing) throw new ApiError(409, 'Tag already exists');
    return tagRepository.create({ ...input, name: input.name.toLowerCase(), createdBy: new Types.ObjectId(userId) });
  }

  async getTags(page?: number, limit?: number, search?: string) {
    return tagRepository.findAll({ page, limit, search });
  }

  async getPopularTags(limit: number = 10) {
    return tagRepository.getPopularTags(limit);
  }

  async updateTag(id: string, input: UpdateTagInput) {
    const tag = await Tag.findById(id).exec();
    if (!tag) throw new ApiError(404, 'Tag not found');
    if (input.name) {
      const existing = await tagRepository.findByName(input.name);
      if (existing && existing._id.toString() !== id) throw new ApiError(409, 'Tag name already in use');
    }
    const updated = await tagRepository.updateById(id, input);
    if (!updated) throw new ApiError(404, 'Tag not found');
    return updated;
  }

  async deleteTag(id: string) {
    const tag = await Tag.findById(id).exec();
    if (!tag) throw new ApiError(404, 'Tag not found');
    const deleted = await tagRepository.deleteById(id);
    if (!deleted) throw new ApiError(404, 'Tag not found');
    return { message: 'Tag deleted successfully' };
  }
}

export const tagService = new TagService();
