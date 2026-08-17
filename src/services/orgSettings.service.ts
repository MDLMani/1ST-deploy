import {
  OrgSettings,
  DEFAULT_CHART_THRESHOLDS,
  DEFAULT_WORK_LIMITS,
  IChartThresholds,
  IWorkLimitConfig,
  IOrgSettings,
  IMonthBand,
  emptyMonthBand,
} from '../models/OrgSettings.model';
import { Ticket } from '../models/Ticket.model';
import { ApiError } from '../utils/ApiError';

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(key: string): { start: Date; end: Date } {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function shiftMonthKey(key: string, deltaMonths: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return monthKey(d);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

/** Daily ticket volume bands for a calendar month. */
export async function computeMonthBand(key: string): Promise<IMonthBand> {
  const { start, end } = monthBounds(key);
  const tickets = await Ticket.find({ createdAt: { $gte: start, $lte: end } })
    .select('createdAt')
    .lean();

  const byDay = new Map<string, number>();
  for (const t of tickets) {
    const d = new Date(t.createdAt);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const daily = [...byDay.values()].sort((a, b) => a - b);
  if (daily.length === 0) {
    return { ...emptyMonthBand(key), low: 0, medium: 0, high: 0, totalTickets: 0 };
  }

  const low = Math.max(1, percentile(daily, 0.25));
  const medium = Math.max(low, percentile(daily, 0.5));
  const high = Math.max(medium, daily[daily.length - 1]);

  return {
    key,
    low,
    medium,
    high,
    totalTickets: tickets.length,
  };
}

/** Past 3 completed months before `activeKey`, oldest → newest. */
async function computePast3Months(activeKey: string): Promise<IMonthBand[]> {
  const keys = [shiftMonthKey(activeKey, -3), shiftMonthKey(activeKey, -2), shiftMonthKey(activeKey, -1)];
  return Promise.all(keys.map((k) => computeMonthBand(k)));
}

function limitFromPast3(past3: IMonthBand[]): number {
  const highs = past3.map((m) => m.high).filter((h) => h > 0);
  if (highs.length === 0) return DEFAULT_CHART_THRESHOLDS.highMax;
  return Math.max(...highs);
}

function thresholdsFromLimit(limit: number, colors = DEFAULT_CHART_THRESHOLDS.colors): IChartThresholds {
  const highMax = Math.max(1, limit);
  return {
    lowMax: highMax,
    mediumMax: highMax,
    highMax,
    colors: {
      low: colors.low || DEFAULT_CHART_THRESHOLDS.colors.low,
      medium: colors.low || DEFAULT_CHART_THRESHOLDS.colors.low,
      high: colors.high || DEFAULT_CHART_THRESHOLDS.colors.high,
    },
  };
}

export class OrgSettingsService {
  async getOrCreate(): Promise<IOrgSettings> {
    let doc = await OrgSettings.findOne({ key: 'default' });
    if (!doc) {
      const now = monthKey();
      const past3Months = await computePast3Months(now);
      const limit = limitFromPast3(past3Months);
      const previous = past3Months[past3Months.length - 1] ?? emptyMonthBand(shiftMonthKey(now, -1));
      const current = await computeMonthBand(now);
      doc = await OrgSettings.create({
        key: 'default',
        chartThresholds: thresholdsFromLimit(limit),
        workLimits: DEFAULT_WORK_LIMITS,
        monthlyAchievement: {
          activeMonth: now,
          previous,
          current,
          past3Months,
          limit,
          lastRolloverAt: new Date(),
        },
      });
    }
    return doc;
  }

  /** Auto month-end rollover + refresh past-3 limit (highest high). */
  async ensureMonthlyRollover(doc: IOrgSettings): Promise<IOrgSettings> {
    const now = monthKey();
    const achievement = doc.monthlyAchievement ?? {
      activeMonth: '',
      previous: emptyMonthBand(''),
      current: emptyMonthBand(''),
      past3Months: [],
      limit: DEFAULT_CHART_THRESHOLDS.highMax,
    };

    const past3Months = await computePast3Months(now);
    const limit = limitFromPast3(past3Months);
    const previous = past3Months[past3Months.length - 1] ?? emptyMonthBand(shiftMonthKey(now, -1));
    const current = await computeMonthBand(now);
    const rolled = achievement.activeMonth !== now;

    doc.monthlyAchievement = {
      activeMonth: now,
      previous,
      current,
      past3Months,
      limit,
      lastRolloverAt: rolled ? new Date() : achievement.lastRolloverAt,
    };
    doc.chartThresholds = thresholdsFromLimit(limit, doc.chartThresholds?.colors);

    const changed =
      rolled ||
      current.high !== achievement.current?.high ||
      current.totalTickets !== achievement.current?.totalTickets ||
      limit !== achievement.limit ||
      !achievement.past3Months?.length;

    if (changed) await doc.save();
    return doc;
  }

  async getPublic() {
    let doc = await this.getOrCreate();
    doc = await this.ensureMonthlyRollover(doc);
    const limit = doc.monthlyAchievement?.limit ?? doc.chartThresholds.highMax ?? 28;
    return {
      chartThresholds: {
        lowMax: limit,
        mediumMax: limit,
        highMax: limit,
        colors: {
          low: doc.chartThresholds.colors?.low || DEFAULT_CHART_THRESHOLDS.colors.low,
          medium: doc.chartThresholds.colors?.low || DEFAULT_CHART_THRESHOLDS.colors.low,
          high: doc.chartThresholds.colors?.high || DEFAULT_CHART_THRESHOLDS.colors.high,
        },
      },
      workLimits: doc.workLimits,
      monthlyAchievement: doc.monthlyAchievement,
      updatedAt: doc.updatedAt,
      autoManaged: true,
    };
  }

  async update(
    patch: {
      chartThresholds?: Partial<IChartThresholds> & { colors?: Partial<IChartThresholds['colors']> };
      workLimits?: Partial<IWorkLimitConfig>;
    },
    updatedBy?: string
  ) {
    const doc = await this.getOrCreate();

    if (patch.chartThresholds?.colors) {
      doc.chartThresholds = {
        ...doc.chartThresholds,
        colors: {
          low: patch.chartThresholds.colors.low || doc.chartThresholds.colors.low,
          medium: patch.chartThresholds.colors.low || doc.chartThresholds.colors.low,
          high: patch.chartThresholds.colors.high || doc.chartThresholds.colors.high,
        },
      };
    }

    if (patch.workLimits) {
      const next = { ...doc.workLimits, ...patch.workLimits };
      if (
        next.monthlyTicketLimit < 1 ||
        next.quickSolveHours < 1 ||
        next.longPausedDays < 1 ||
        next.postTimePendingHours < 1
      ) {
        throw new ApiError(400, 'Work limit values must be positive');
      }
      doc.workLimits = next;
    }

    if (updatedBy) doc.updatedBy = updatedBy as any;
    await doc.save();
    return this.getPublic();
  }
}

export const orgSettingsService = new OrgSettingsService();
