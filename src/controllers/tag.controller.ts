import { Response } from 'express';
import { tagService } from '../services/tag.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { TagInput, UpdateTagInput } from '../validators';

export const createTag = asyncHandler(async (req, res: Response) => {
  const input = req.body as TagInput;
  const tag = await tagService.createTag(input, req.user!.userId);
  sendSuccess(res, 'Tag created successfully', tag, 201);
});

export const getTags = asyncHandler(async (req, res: Response) => {
  const { page, limit, search } = req.query as any;
  const result = await tagService.getTags(page ? Number(page) : undefined, limit ? Number(limit) : undefined, search as string);
  sendSuccess(res, 'Tags retrieved', result.tags, 200, { total: result.total });
});

export const getPopularTags = asyncHandler(async (req, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const tags = await tagService.getPopularTags(limit);
  sendSuccess(res, 'Popular tags retrieved', tags);
});

export const updateTag = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateTagInput;
  const tag = await tagService.updateTag(getRouteParam(req.params.id), input);
  sendSuccess(res, 'Tag updated', tag);
});

export const deleteTag = asyncHandler(async (req, res: Response) => {
  const result = await tagService.deleteTag(getRouteParam(req.params.id));
  sendSuccess(res, result.message);
});
