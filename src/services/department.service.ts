import { departmentRepository } from '../repositories/department.repository';
import { ApiError } from '../utils/ApiError';
import { DepartmentInput, UpdateDepartmentInput } from '../validators';
import { IDepartment } from '../models/Department.model';

export class DepartmentService {
  async createDepartment(input: DepartmentInput) {
    const existing = await departmentRepository.findBySlug(input.slug);
    if (existing) throw new ApiError(409, 'Department with this slug already exists');
    return departmentRepository.create(input as Partial<IDepartment>);
  }

  async getDepartments() {
    return departmentRepository.findAll();
  }

  async getDepartmentById(id: string) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw new ApiError(404, 'Department not found');
    return dept;
  }

  async getDepartmentBySlug(slug: string) {
    const dept = await departmentRepository.findBySlug(slug);
    if (!dept) throw new ApiError(404, 'Department not found');
    return dept;
  }

  async updateDepartment(id: string, input: UpdateDepartmentInput) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw new ApiError(404, 'Department not found');
    const updated = await departmentRepository.updateById(id, input);
    if (!updated) throw new ApiError(404, 'Department not found');
    return updated;
  }

  async deleteDepartment(id: string) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw new ApiError(404, 'Department not found');
    const deleted = await departmentRepository.deleteById(id);
    if (!deleted) throw new ApiError(404, 'Department not found');
    return { message: 'Department deleted successfully' };
  }
}

export const departmentService = new DepartmentService();
