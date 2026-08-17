import { Response } from 'express';
import { customFieldService } from '../services/customField.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { CustomFieldInput, UpdateCustomFieldInput, ReorderCustomFieldsInput } from '../validators';

export const createCustomField = asyncHandler(async (req, res: Response) => {
  const input = req.body as CustomFieldInput;
  const field = await customFieldService.createCustomField(input);
  sendSuccess(res, 'Custom field created', field, 201);
});

export const getCustomFields = asyncHandler(async (req, res: Response) => {
  const departmentId = req.query.department as string | undefined;
  const fields = await customFieldService.getCustomFields(departmentId);
  sendSuccess(res, 'Custom fields retrieved', fields);
});

export const updateCustomField = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateCustomFieldInput;
  const field = await customFieldService.updateCustomField(getRouteParam(req.params.id), input);
  sendSuccess(res, 'Custom field updated', field);
});

export const deleteCustomField = asyncHandler(async (req, res: Response) => {
  const result = await customFieldService.deleteCustomField(getRouteParam(req.params.id));
  sendSuccess(res, result.message);
});

export const reorderCustomFields = asyncHandler(async (req, res: Response) => {
  const input = req.body as ReorderCustomFieldsInput;
  const result = await customFieldService.reorderCustomFields(input);
  sendSuccess(res, result.message);
});
