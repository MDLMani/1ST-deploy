import { FilterQuery, UpdateQuery } from 'mongoose';
import { EscalationRule, IEscalationRule } from '../models/EscalationRule.model';
import { EscalationTrigger } from '../constants';

export class EscalationRuleRepository {
  async create(data: Partial<IEscalationRule>): Promise<IEscalationRule> {
    return EscalationRule.create(data);
  }

  async findActiveRules(trigger?: EscalationTrigger): Promise<IEscalationRule[]> {
    const filter: FilterQuery<IEscalationRule> = { isActive: true };
    if (trigger) filter.trigger = trigger;
    return EscalationRule.find(filter).exec();
  }

  async findById(id: string): Promise<IEscalationRule | null> {
    return EscalationRule.findById(id).exec();
  }

  async findAll(): Promise<IEscalationRule[]> {
    return EscalationRule.find().sort({ name: 1 }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IEscalationRule>): Promise<IEscalationRule | null> {
    return EscalationRule.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await EscalationRule.findByIdAndDelete(id).exec();
    return !!result;
  }
}

export const escalationRuleRepository = new EscalationRuleRepository();
