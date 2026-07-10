import { Satisfaction, ISatisfactionResponse } from '../models/Satisfaction.model';

export class SatisfactionRepository {
  async submitRating(data: Partial<ISatisfactionResponse>): Promise<ISatisfactionResponse> {
    return Satisfaction.create(data);
  }

  async findByTicketId(ticketId: string): Promise<ISatisfactionResponse | null> {
    return Satisfaction.findOne({ ticket: ticketId }).exec();
  }

  async getCSATStats(): Promise<{
    totalResponses: number;
    averageRating: number;
    distribution: { rating: number; count: number; percentage: number }[];
    trends: { month: string; avg: number; count: number }[];
  }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [totalResponses, avgResult, distribution, trendsAgg] = await Promise.all([
      Satisfaction.countDocuments(),
      Satisfaction.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]),
      Satisfaction.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Satisfaction.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
    ]);

    const averageRating = avgResult[0]?.avg ?? 0;
    const dist = distribution.map((d) => ({
      rating: d._id,
      count: d.count,
      percentage: totalResponses > 0 ? Math.round((d.count / totalResponses) * 100) : 0,
    }));
    const trends = trendsAgg.map((t) => ({
      month: `${t._id.y}-${String(t._id.m).padStart(2, '0')}`,
      avg: Math.round(t.avg * 100) / 100,
      count: t.count,
    }));

    return { totalResponses, averageRating: Math.round(averageRating * 100) / 100, distribution: dist, trends };
  }
}

export const satisfactionRepository = new SatisfactionRepository();
