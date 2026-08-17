import { UpdateQuery } from 'mongoose';
import { AssignmentRule, IAssignmentRule } from '../models/AssignmentRule.model';

export class AssignmentRuleRepository {
  async create(data: Partial<IAssignmentRule>): Promise<IAssignmentRule> {
    return AssignmentRule.create(data);
  }

  async findById(id: string): Promise<IAssignmentRule | null> {
    return AssignmentRule.findById(id).populate('department', 'name slug').exec();
  }

  async findMatchingRules(
    departmentId: string,
    category?: string,
    priority?: string
  ): Promise<IAssignmentRule[]> {
    const filter: Record<string, unknown> = {
      department: departmentId,
      isActive: true,
    };
    const rules = await AssignmentRule.find(filter).sort({ weight: -1 }).exec();
    return rules.filter((rule) => {
      if (rule.category && category && rule.category !== category) return false;
      if (rule.priority && priority && rule.priority !== priority) return false;
      return true;
    });
  }

  async findAll(): Promise<IAssignmentRule[]> {
    return AssignmentRule.find()
      .populate('department', 'name slug')
      .sort({ weight: -1, createdAt: -1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<IAssignmentRule>): Promise<IAssignmentRule | null> {
    return AssignmentRule.findByIdAndUpdate(id, data, { new: true })
      .populate('department', 'name slug')
      .exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await AssignmentRule.findByIdAndDelete(id).exec();
    return !!result;
  }

  async incrementRoundRobin(ruleId: string, nextIndex: number): Promise<void> {
    await AssignmentRule.findByIdAndUpdate(ruleId, { lastAssignedIndex: nextIndex }).exec();
  }
}

export const assignmentRuleRepository = new AssignmentRuleRepository();
