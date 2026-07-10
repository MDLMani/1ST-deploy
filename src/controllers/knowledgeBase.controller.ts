import { Response } from 'express';
import { knowledgeBaseService } from '../services/knowledgeBase.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ArticleInput, UpdateArticleInput, VoteArticleInput } from '../validators';

export const createArticle = asyncHandler(async (req, res: Response) => {
  const input = req.body as ArticleInput;
  const article = await knowledgeBaseService.createArticle(input, req.user!.userId);
  sendSuccess(res, 'Article created', article, 201);
});

export const getArticles = asyncHandler(async (req, res: Response) => {
  const { page, limit, category } = req.query as any;
  const result = await knowledgeBaseService.getArticles(page ? Number(page) : undefined, limit ? Number(limit) : undefined, category as string);
  sendSuccess(res, 'Articles retrieved', result.articles, 200, { total: result.total });
});

export const getArticleBySlug = asyncHandler(async (req, res: Response) => {
  const article = await knowledgeBaseService.getArticleBySlug(String(req.params.slug));
  sendSuccess(res, 'Article retrieved', article);
});

export const searchArticles = asyncHandler(async (req, res: Response) => {
  const { q, category, page, limit } = req.query as any;
  const result = await knowledgeBaseService.searchArticles(q, page ? Number(page) : undefined, limit ? Number(limit) : undefined, category as string);
  sendSuccess(res, 'Search results', result.articles, 200, { total: result.total });
});

export const getSuggestedArticles = asyncHandler(async (req, res: Response) => {
  const { category, tags, limit } = req.query as any;
  const tagList = tags ? (tags as string).split(',') : [];
  const articles = await knowledgeBaseService.getSuggestedArticles(category || '', tagList, limit ? Number(limit) : 3);
  sendSuccess(res, 'Suggested articles', articles);
});

export const voteHelpful = asyncHandler(async (req, res: Response) => {
  const input = req.body as VoteArticleInput;
  const result = await knowledgeBaseService.voteHelpful(getRouteParam(req.params.id), input.helpful);
  sendSuccess(res, result.message);
});

export const updateArticle = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateArticleInput;
  const article = await knowledgeBaseService.updateArticle(getRouteParam(req.params.id), input);
  sendSuccess(res, 'Article updated', article);
});

export const deleteArticle = asyncHandler(async (req, res: Response) => {
  const result = await knowledgeBaseService.deleteArticle(getRouteParam(req.params.id));
  sendSuccess(res, result.message);
});
