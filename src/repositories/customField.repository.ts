import { FilterQuery, UpdateQuery } from 'mongoose';
import { CustomField, ICustomField } from '../models/CustomField.model';

export class CustomFieldRepository {
  async create(data: Partial<ICustomField>): Promise<ICustomField> {
    return CustomField.create(data);
  }

  async findByKey(key: string): Promise<ICustomField | null> {
    return CustomField.findOne({ key }).exec();
  }

  async findByDepartment(departmentId?: string): Promise<ICustomField[]> {
    const filter: FilterQuery<ICustomField> = { isActive: true };
    if (departmentId && /^[a-fA-F0-9]{24}$/.test(departmentId)) {
      filter.$or = [{ department: departmentId }, { department: null }];
    } else {
      filter.department = null;
    }
    return CustomField.find(filter).sort({ displayOrder: 1 }).exec();
  }

  async findById(id: string): Promise<ICustomField | null> {
    return CustomField.findById(id).exec();
  }

  async updateById(id: string, data: UpdateQuery<ICustomField>): Promise<ICustomField | null> {
    return CustomField.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await CustomField.findByIdAndDelete(id).exec();
    return !!result;
  }

  async reorder(fields: { id: string; displayOrder: number }[]): Promise<void> {
    const ops = fields.map((f) => ({
      updateOne: { filter: { _id: f.id }, update: { displayOrder: f.displayOrder } },
    }));
    await CustomField.bulkWrite(ops);
  }
}

export const customFieldRepository = new CustomFieldRepository();
