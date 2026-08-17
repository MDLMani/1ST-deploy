import { knowledgeBaseRepository } from '../repositories/knowledgeBase.repository';
import { ApiError } from '../utils/ApiError';
import { ArticleInput, UpdateArticleInput } from '../validators';
import { Types } from 'mongoose';

export class KnowledgeBaseService {
  async createArticle(input: ArticleInput, userId: string) {
    const existing = await knowledgeBaseRepository.findBySlug(input.slug);
    if (existing) throw new ApiError(409, 'Article with this slug already exists');
    return knowledgeBaseRepository.create({
      ...input,
      author: new Types.ObjectId(userId),
      department: input.department ? new Types.ObjectId(input.department) : undefined,
    });
  }

  async getArticles(page?: number, limit?: number, category?: string) {
    return knowledgeBaseRepository.search('', { page, limit, category, isPublished: true });
  }

  async getArticleBySlug(slug: string) {
    const article = await knowledgeBaseRepository.findBySlug(slug);
    if (!article) throw new ApiError(404, 'Article not found');
    await knowledgeBaseRepository.incrementView(article._id.toString());
    return article;
  }

  async searchArticles(query: string, page?: number, limit?: number, category?: string) {
    return knowledgeBaseRepository.search(query, { page, limit, category, isPublished: true });
  }

  async getSuggestedArticles(category: string, tags: string[], limit: number = 3) {
    return knowledgeBaseRepository.getSuggestedArticles(category, tags, limit);
  }

  async voteHelpful(id: string, helpful: boolean) {
    const article = await knowledgeBaseRepository.findById(id);
    if (!article) throw new ApiError(404, 'Article not found');
    await knowledgeBaseRepository.incrementHelpful(id, helpful);
    return { message: 'Vote recorded' };
  }

  async updateArticle(id: string, input: UpdateArticleInput) {
    const article = await knowledgeBaseRepository.findById(id);
    if (!article) throw new ApiError(404, 'Article not found');
    if (input.slug && input.slug !== article.slug) {
      const existing = await knowledgeBaseRepository.findBySlug(input.slug);
      if (existing) throw new ApiError(409, 'Slug already in use');
    }
    const updated = await knowledgeBaseRepository.updateById(id, input);
    if (!updated) throw new ApiError(404, 'Article not found');
    return updated;
  }

  async deleteArticle(id: string) {
    const article = await knowledgeBaseRepository.findById(id);
    if (!article) throw new ApiError(404, 'Article not found');
    const deleted = await knowledgeBaseRepository.deleteById(id);
    if (!deleted) throw new ApiError(404, 'Article not found');
    return { message: 'Article deleted successfully' };
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
