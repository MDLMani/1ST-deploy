import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMonthBand {
  key: string; // YYYY-MM
  low: number;
  medium: number;
  high: number;
  totalTickets: number;
}

export interface IChartThresholds {
  /** Display / legacy low marker (previous month low). */
  lowMax: number;
  /** Orange band starts here. Everything below this is green. */
  mediumMax: number;
  /** Red band starts here (previous month high / peak). */
  highMax: number;
  colors: {
    low: string;
    medium: string;
    high: string;
  };
}

export interface IWorkLimitConfig {
  monthlyTicketLimit: number;
  quickSolveHours: number;
  longPausedDays: number;
  postTimePendingHours: number;
}

export interface IMonthlyAchievement {
  /** Calendar month currently being tracked (YYYY-MM). */
  activeMonth: string;
  previous: IMonthBand;
  current: IMonthBand;
  /** Last 3 completed months used to set the green/red limit (highest high). */
  past3Months: IMonthBand[];
  /** Limit = highest `high` among past3Months. Within ≤ green, above → red. */
  limit: number;
  lastRolloverAt?: Date;
}

export interface IOrgSettings extends Document {
  key: string;
  chartThresholds: IChartThresholds;
  workLimits: IWorkLimitConfig;
  monthlyAchievement: IMonthlyAchievement;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_CHART_THRESHOLDS: IChartThresholds = {
  lowMax: 10,
  mediumMax: 28,
  highMax: 28,
  colors: {
    low: '#22C55E',
    medium: '#22C55E',
    high: '#C8102E',
  },
};

export const DEFAULT_WORK_LIMITS: IWorkLimitConfig = {
  monthlyTicketLimit: 200,
  quickSolveHours: 24,
  longPausedDays: 7,
  postTimePendingHours: 48,
};

export const emptyMonthBand = (key: string): IMonthBand => ({
  key,
  low: 0,
  medium: 0,
  high: 0,
  totalTickets: 0,
});

const monthBandSchema = new Schema<IMonthBand>(
  {
    key: { type: String, required: true },
    low: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    totalTickets: { type: Number, default: 0 },
  },
  { _id: false }
);

const orgSettingsSchema = new Schema<IOrgSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    chartThresholds: {
      lowMax: { type: Number, default: DEFAULT_CHART_THRESHOLDS.lowMax },
      mediumMax: { type: Number, default: DEFAULT_CHART_THRESHOLDS.mediumMax },
      highMax: { type: Number, default: DEFAULT_CHART_THRESHOLDS.highMax },
      colors: {
        low: { type: String, default: DEFAULT_CHART_THRESHOLDS.colors.low },
        medium: { type: String, default: DEFAULT_CHART_THRESHOLDS.colors.medium },
        high: { type: String, default: DEFAULT_CHART_THRESHOLDS.colors.high },
      },
    },
    workLimits: {
      monthlyTicketLimit: { type: Number, default: DEFAULT_WORK_LIMITS.monthlyTicketLimit },
      quickSolveHours: { type: Number, default: DEFAULT_WORK_LIMITS.quickSolveHours },
      longPausedDays: { type: Number, default: DEFAULT_WORK_LIMITS.longPausedDays },
      postTimePendingHours: { type: Number, default: DEFAULT_WORK_LIMITS.postTimePendingHours },
    },
    monthlyAchievement: {
      activeMonth: { type: String, default: '' },
      previous: { type: monthBandSchema, default: () => emptyMonthBand('') },
      current: { type: monthBandSchema, default: () => emptyMonthBand('') },
      past3Months: { type: [monthBandSchema], default: [] },
      limit: { type: Number, default: DEFAULT_CHART_THRESHOLDS.highMax },
      lastRolloverAt: { type: Date },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const OrgSettings = mongoose.model<IOrgSettings>('OrgSettings', orgSettingsSchema);
