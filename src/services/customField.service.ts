import { customFieldRepository } from '../repositories/customField.repository';
import { ApiError } from '../utils/ApiError';
import { CustomFieldInput, UpdateCustomFieldInput, ReorderCustomFieldsInput } from '../validators';
import { Types } from 'mongoose';

export class CustomFieldService {
  async createCustomField(input: CustomFieldInput) {
    const existing = await customFieldRepository.findByKey(input.key);
    if (existing) throw new ApiError(409, 'Custom field with this key already exists');
    return customFieldRepository.create({
      ...input,
      department: input.department ? new Types.ObjectId(input.department) : undefined,
    });
  }

  async getCustomFields(departmentId?: string) {
    return customFieldRepository.findByDepartment(departmentId);
  }

  async updateCustomField(id: string, input: UpdateCustomFieldInput) {
    const field = await customFieldRepository.findById(id);
    if (!field) throw new ApiError(404, 'Custom field not found');
    const updated = await customFieldRepository.updateById(id, input);
    if (!updated) throw new ApiError(404, 'Custom field not found');
    return updated;
  }

  async deleteCustomField(id: string) {
    const field = await customFieldRepository.findById(id);
    if (!field) throw new ApiError(404, 'Custom field not found');
    const deleted = await customFieldRepository.deleteById(id);
    if (!deleted) throw new ApiError(404, 'Custom field not found');
    return { message: 'Custom field deleted successfully' };
  }

  async reorderCustomFields(input: ReorderCustomFieldsInput) {
    await customFieldRepository.reorder(input.fields);
    return { message: 'Fields reordered successfully' };
  }

  async validateCustomFields(departmentId: string | undefined, customFields: Record<string, any>) {
    const fields = await customFieldRepository.findByDepartment(departmentId);
    const required = fields.filter((f) => f.isRequired);
    const missing = required.filter((f) => customFields[f.key] === undefined || customFields[f.key] === '');
    if (missing.length > 0) {
      throw new ApiError(400, `Missing required custom fields: ${missing.map((f) => f.name).join(', ')}`);
    }
  }
}

export const customFieldService = new CustomFieldService();
