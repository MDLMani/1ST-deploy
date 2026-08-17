import { FilterQuery, UpdateQuery } from 'mongoose';
import { Department, IDepartment } from '../models/Department.model';

export class DepartmentRepository {
  async create(data: Partial<IDepartment>): Promise<IDepartment> {
    return Department.create(data);
  }

  async findById(id: string): Promise<IDepartment | null> {
    try {
      return await Department.findById(id).exec();
    } catch (err) {
      if ((err as { name?: string }).name === 'CastError') return null;
      throw err;
    }
  }

  async findBySlug(slug: string): Promise<IDepartment | null> {
    return Department.findOne({ slug }).exec();
  }

  async findAll(filter: FilterQuery<IDepartment> = {}): Promise<IDepartment[]> {
    return Department.find({ ...filter, isActive: true }).sort({ name: 1 }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IDepartment>): Promise<IDepartment | null> {
    return Department.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await Department.findByIdAndUpdate(id, { isActive: false }).exec();
    return !!result;
  }
}

export const departmentRepository = new DepartmentRepository();
