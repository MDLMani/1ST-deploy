import { FilterQuery, UpdateQuery } from 'mongoose';
import { Tag, ITag } from '../models/Tag.model';

export interface TagQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export class TagRepository {
  async create(data: Partial<ITag>): Promise<ITag> {
    return Tag.create(data);
  }

  async findByName(name: string): Promise<ITag | null> {
    return Tag.findOne({ name: name.toLowerCase() }).exec();
  }

  async findByIds(ids: string[]): Promise<ITag[]> {
    return Tag.find({ _id: { $in: ids } }).exec();
  }

  async findAll(options: TagQueryOptions = {}): Promise<{ tags: ITag[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const filter: FilterQuery<ITag> = {};
    if (options.search) {
      filter.name = { $regex: options.search, $options: 'i' };
    }
    const [tags, total] = await Promise.all([
      Tag.find(filter).sort({ usageCount: -1 }).skip(skip).limit(limit).exec(),
      Tag.countDocuments(filter).exec(),
    ]);
    return { tags, total };
  }

  async updateById(id: string, data: UpdateQuery<ITag>): Promise<ITag | null> {
    return Tag.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await Tag.findByIdAndDelete(id).exec();
    return !!result;
  }

  async incrementUsage(tagIds: string[]): Promise<void> {
    await Tag.updateMany({ _id: { $in: tagIds } }, { $inc: { usageCount: 1 } }).exec();
  }

  async decrementUsage(tagIds: string[]): Promise<void> {
    await Tag.updateMany({ _id: { $in: tagIds } }, { $inc: { usageCount: -1 } }).exec();
  }

  async getPopularTags(limit: number = 10): Promise<ITag[]> {
    return Tag.find().sort({ usageCount: -1 }).limit(limit).exec();
  }
}

export const tagRepository = new TagRepository();
