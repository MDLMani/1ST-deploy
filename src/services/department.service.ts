import { AssignmentStrategy, SERVICE_DEPARTMENTS } from '../constants';
import { departmentRepository } from '../repositories/department.repository';
import { ApiError } from '../utils/ApiError';
import { DepartmentInput, UpdateDepartmentInput } from '../validators';
import { IDepartment } from '../models/Department.model';
import { logger } from '../utils/logger';

export type DepartmentSeedStats = {
  upserted: number;
  skipped: number;
  total: number;
};

let seedPromise: Promise<DepartmentSeedStats> | null = null;

export class DepartmentService {
  async createDepartment(input: DepartmentInput) {
    const existing = await departmentRepository.findBySlug(input.slug);
    if (existing) throw new ApiError(409, 'Department with this slug already exists');
    return departmentRepository.create(input as Partial<IDepartment>);
  }

  async seed(options: { force?: boolean } = {}): Promise<DepartmentSeedStats> {
    let upserted = 0;
    let skipped = 0;

    for (const dept of SERVICE_DEPARTMENTS) {
      const existing = await departmentRepository.findBySlug(dept.slug);
      if (existing && !options.force) {
        if (!existing.isActive) {
          await departmentRepository.updateById(String(existing._id), {
            isActive: true,
            name: dept.name,
            description: dept.description,
          });
          upserted += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      if (existing && options.force) {
        await departmentRepository.updateById(String(existing._id), {
          name: dept.name,
          description: dept.description,
          isActive: true,
          assignmentStrategy: AssignmentStrategy.LOAD_BALANCED,
        });
        upserted += 1;
        continue;
      }

      await departmentRepository.create({
        name: dept.name,
        slug: dept.slug,
        description: dept.description,
        assignmentStrategy: AssignmentStrategy.LOAD_BALANCED,
        isActive: true,
      });
      upserted += 1;
    }

    return { upserted, skipped, total: SERVICE_DEPARTMENTS.length };
  }

  async ensureSeeded(): Promise<void> {
    if (!seedPromise) {
      seedPromise = this.seed().catch((error) => {
        seedPromise = null;
        throw error;
      });
    }
    await seedPromise;
  }

  async getDepartments() {
    await this.ensureSeeded().catch((error) => {
      logger.error('Department seed failed during list', { error });
    });
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
