import { FilterQuery, UpdateQuery } from 'mongoose';
import { CannedResponse, ICannedResponse } from '../models/CannedResponse.model';

export interface CannedResponseQueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export class CannedResponseRepository {
  async create(data: Partial<ICannedResponse>): Promise<ICannedResponse> {
    return CannedResponse.create(data);
  }

  async findById(id: string): Promise<ICannedResponse | null> {
    return CannedResponse.findById(id).exec();
  }

  async findByUser(userId: string, options: CannedResponseQueryOptions = {}): Promise<{ responses: ICannedResponse[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const filter: FilterQuery<ICannedResponse> = { $or: [{ createdBy: userId }, { isGlobal: true }] };
    if (options.category) filter.category = options.category;
    if (options.search) filter.title = { $regex: options.search, $options: 'i' };
    const [responses, total] = await Promise.all([
      CannedResponse.find(filter).sort({ usageCount: -1 }).skip(skip).limit(limit).exec(),
      CannedResponse.countDocuments(filter).exec(),
    ]);
    return { responses, total };
  }

  async findByShortcut(shortcut: string, userId: string): Promise<ICannedResponse | null> {
    return CannedResponse.findOne({
      shortcut,
      $or: [{ createdBy: userId }, { isGlobal: true }],
    }).exec();
  }

  async updateById(id: string, data: UpdateQuery<ICannedResponse>): Promise<ICannedResponse | null> {
    return CannedResponse.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await CannedResponse.findByIdAndDelete(id).exec();
    return !!result;
  }

  async incrementUsage(id: string): Promise<void> {
    await CannedResponse.findByIdAndUpdate(id, { $inc: { usageCount: 1 } }).exec();
  }
}

export const cannedResponseRepository = new CannedResponseRepository();
