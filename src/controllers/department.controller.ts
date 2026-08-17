import { Response } from 'express';
import { departmentService } from '../services/department.service';
import { asyncHandler, getRouteParam } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { DepartmentInput, UpdateDepartmentInput } from '../validators';

export const createDepartment = asyncHandler(async (req, res: Response) => {
  const input = req.body as DepartmentInput;
  const department = await departmentService.createDepartment(input);
  sendSuccess(res, 'Department created successfully', department, 201);
});

export const getDepartments = asyncHandler(async (_req, res: Response) => {
  const departments = await departmentService.getDepartments();
  sendSuccess(res, 'Departments retrieved', departments);
});

export const getDepartmentById = asyncHandler(async (req, res: Response) => {
  const department = await departmentService.getDepartmentById(getRouteParam(req.params.id));
  sendSuccess(res, 'Department retrieved', department);
});

export const updateDepartment = asyncHandler(async (req, res: Response) => {
  const input = req.body as UpdateDepartmentInput;
  const department = await departmentService.updateDepartment(getRouteParam(req.params.id), input);
  sendSuccess(res, 'Department updated', department);
});

export const deleteDepartment = asyncHandler(async (req, res: Response) => {
  const result = await departmentService.deleteDepartment(getRouteParam(req.params.id));
  sendSuccess(res, result.message);
});
