import { FilterQuery, UpdateQuery } from 'mongoose';
import { KnowledgeBase, IKnowledgeBase } from '../models/KnowledgeBase.model';

export interface KBQueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  isPublished?: boolean;
}

export class KnowledgeBaseRepository {
  async create(data: Partial<IKnowledgeBase>): Promise<IKnowledgeBase> {
    return KnowledgeBase.create(data);
  }

  async findById(id: string): Promise<IKnowledgeBase | null> {
    return KnowledgeBase.findById(id).populate('author', 'name email').populate('department', 'name slug').exec();
  }

  async findBySlug(slug: string): Promise<IKnowledgeBase | null> {
    return KnowledgeBase.findOne({ slug }).populate('author', 'name email').populate('department', 'name slug').exec();
  }

  async search(query: string, options: KBQueryOptions = {}): Promise<{ articles: IKnowledgeBase[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;
    const filter: FilterQuery<IKnowledgeBase> = { isPublished: options.isPublished ?? true };
    if (options.category) filter.category = options.category;
    if (query) filter.$text = { $search: query };
    const [articles, total] = await Promise.all([
      KnowledgeBase.find(filter)
        .sort(query ? ({ score: { $meta: 'textScore' } } as any) : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'name email')
        .exec(),
      KnowledgeBase.countDocuments(filter).exec(),
    ]);
    return { articles, total };
  }

  async findByCategory(category: string): Promise<IKnowledgeBase[]> {
    return KnowledgeBase.find({ category, isPublished: true }).sort({ title: 1 }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IKnowledgeBase>): Promise<IKnowledgeBase | null> {
    return KnowledgeBase.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await KnowledgeBase.findByIdAndDelete(id).exec();
    return !!result;
  }

  async incrementView(id: string): Promise<void> {
    await KnowledgeBase.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();
  }

  async incrementHelpful(id: string, helpful: boolean): Promise<void> {
    const field = helpful ? 'helpfulCount' : 'notHelpfulCount';
    await KnowledgeBase.findByIdAndUpdate(id, { $inc: { [field]: 1 } }).exec();
  }

  async getSuggestedArticles(category: string, tags: string[], limit: number = 3): Promise<IKnowledgeBase[]> {
    return KnowledgeBase.find({
      isPublished: true,
      $or: [{ category }, { tags: { $in: tags } }],
    })
      .sort({ viewCount: -1 })
      .limit(limit)
      .exec();
  }
}

export const knowledgeBaseRepository = new KnowledgeBaseRepository();
