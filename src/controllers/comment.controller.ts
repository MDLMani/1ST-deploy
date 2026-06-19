import { Response } from 'express';
import { commentService } from '../services/comment.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { CreateCommentInput } from '../validators';

export const addComment = asyncHandler(async (req, res: Response) => {
  const input = req.body as CreateCommentInput;
  const comment = await commentService.addComment(
    getRouteParam(req.params.id),
    req.user!.userId,
    req.user!.role,
    input
  );
  sendSuccess(res, 'Comment added successfully', comment, 201);
});

export const getComments = asyncHandler(async (req, res: Response) => {
  const comments = await commentService.getComments(
    getRouteParam(req.params.id),
    req.user!.userId,
    req.user!.role
  );
  sendSuccess(res, 'Comments retrieved', comments);
});
