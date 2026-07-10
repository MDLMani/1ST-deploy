# Implementation Plan: 11 Modern Features for TVK Support System

## Table of Contents
1. [Cross-Cutting Changes](#1-cross-cutting-changes)
2. [Feature 1: SLA Management](#2-sla-management)
3. [Feature 2: Ticket Tags & Labels](#3-ticket-tags--labels)
4. [Feature 3: Internal Notes](#4-internal-notes)
5. [Feature 4: Ticket Merging](#5-ticket-merging)
6. [Feature 5: Customer Satisfaction (CSAT)](#6-customer-satisfaction-csat)
7. [Feature 6: Custom Fields](#7-custom-fields)
8. [Feature 7: Multi-Department Routing](#8-multi-department-routing)
9. [Feature 8: Knowledge Base Linking](#9-knowledge-base-linking)
10. [Feature 9: Auto-Assignment Rules](#10-auto-assignment-rules)
11. [Feature 10: Ticket Canned Responses](#11-ticket-canned-responses)
12. [Feature 11: Escalation Rules](#12-escalation-rules)
13. [Feature Interaction Matrix](#13-feature-interaction-matrix)
14. [Migration Strategy](#14-migration-strategy)
15. [Database Indexes](#15-database-indexes)
16. [Implementation Order](#16-implementation-order)

---

## 1. Cross-Cutting Changes

### 1.1 New Enums and Constants — `src/constants/index.ts`

**MODIFY** existing file to add:

```typescript
// --- Existing enums stay unchanged ---

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// NEW enums to add:

export enum Department {
  BILLING = 'BILLING',
  TECH_SUPPORT = 'TECH_SUPPORT',
  SALES = 'SALES',
  GENERAL = 'GENERAL',
}

export enum SLAStatus {
  ACTIVE = 'ACTIVE',
  BREACHED = 'BREACHED',
  WARNING = 'WARNING',
  MET = 'MET',
}

export enum EscalationLevel {
  NONE = 'NONE',
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
}

export enum AssignmentStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  LOAD_BALANCED = 'LOAD_BALANCED',
  SKILL_BASED = 'SKILL_BASED',
  LEAST_RECENTLY_ASSIGNED = 'LEAST_RECENTLY_ASSIGNED',
}

export enum FieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  DROPDOWN = 'DROPDOWN',
  DATE = 'DATE',
  NUMBER = 'NUMBER',
  CHECKBOX = 'CHECKBOX',
}

export enum CSATRating {
  VERY_DISSATISFIED = 1,
  DISSATISFIED = 2,
  NEUTRAL = 3,
  SATISFIED = 4,
  VERY_SATISFIED = 5,
}

export enum MergeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REVERTED = 'REVERTED',
}

export enum EscalationTrigger {
  TIME_BASED = 'TIME_BASED',
  PRIORITY_BASED = 'PRIORITY_BASED',
  SLA_BREACH = 'SLA_BREACH',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  NO_RESPONSE = 'NO_RESPONSE',
}

// NEW socket events to add to SOCKET_EVENTS:
// TICKET_MERGED, NOTE_ADDED, CSAT_SUBMITTED, DEPARTMENT_ASSIGNED,
// ESCALATION_TRIGGERED, SLA_BREACH_WARNING, TAG_UPDATED,
// CANNED_RESPONSE_USED, AUTO_ASSIGNED
```

Updated `SOCKET_EVENTS`:
```typescript
export const SOCKET_EVENTS = {
  // Existing
  TICKET_CREATED: 'ticketCreated',
  TICKET_UPDATED: 'ticketUpdated',
  TICKET_ASSIGNED: 'ticketAssigned',
  TICKET_OVERDUE: 'ticketOverdue',
  NEW_COMMENT: 'newComment',
  // New
  TICKET_MERGED: 'ticketMerged',
  NOTE_ADDED: 'noteAdded',
  CSAT_SUBMITTED: 'csatSubmitted',
  DEPARTMENT_ASSIGNED: 'departmentAssigned',
  ESCALATION_TRIGGERED: 'escalationTriggered',
  SLA_BREACH_WARNING: 'slaBreachWarning',
  SLA_BREACHED: 'slaBreached',
  TAG_UPDATED: 'tagUpdated',
  CANNED_RESPONSE_USED: 'cannedResponseUsed',
  AUTO_ASSIGNED: 'autoAssigned',
  TICKET_UPDATED_FULL: 'ticketUpdatedFull',
} as const;
```

### 1.2 New Interfaces — `src/interfaces/index.ts`

**MODIFY** to add:

```typescript
// Existing interfaces stay unchanged

// NEW:
export interface ISLAConfig {
  responseTimeMinutes: number;   // first response SLA
  resolutionTimeMinutes: number; // resolution SLA
}

export interface ITicketSLA {
  responseDeadline: Date;
  resolutionDeadline: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  status: SLAStatus;
}

export interface ICustomFieldValue {
  field: Types.ObjectId;
  value: string | number | boolean | Date;
}

export interface IEscalationHistory {
  level: EscalationLevel;
  escalatedTo?: Types.ObjectId;
  escalatedAt: Date;
  reason: string;
  triggeredBy: EscalationTrigger;
}
```

### 1.3 Updated User Model — `src/models/User.model.ts`

**MODIFY** to add department and skills fields:

```typescript
export interface IUser extends Document {
  // Existing fields unchanged...
  name: string;
  email: string;
  password: string;
  role: UserRole;

  // NEW fields:
  department?: Department;
  skills?: string[];       // e.g. ['billing', 'refund', 'technical']
  isActive?: boolean;       // soft-disable for load balancing
  maxTicketLoad?: number;   // max concurrent tickets for load-balanced assignment
}
```

Add to schema:
```typescript
department: {
  type: String,
  enum: Object.values(Department),
},
skills: {
  type: [String],
  default: [],
},
isActive: {
  type: Boolean,
  default: true,
},
maxTicketLoad: {
  type: Number,
  default: 20,
},
```

Add index: `userSchema.index({ department: 1, role: 1, isActive: 1 });`

---

## 2. SLA Management

### 2.1 Model — `src/models/SLAPolicy.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { TicketPriority, Department } from '../constants';

export interface ISLAPolicy extends Document {
  name: string;
  department: Department;
  priority: TicketPriority;
  responseTimeMinutes: number;   // e.g. 30 for CRITICAL
  resolutionTimeMinutes: number; // e.g. 4 for CRITICAL (hours → minutes)
  warningThresholdPercent: number; // e.g. 80 = warn at 80% of deadline
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const slaPolicySchema = new Schema<ISLAPolicy>(
  {
    name: { type: String, required: true, trim: true },
    department: { type: String, enum: Object.values(Department), required: true },
    priority: { type: String, enum: Object.values(TicketPriority), required: true },
    responseTimeMinutes: { type: Number, required: true, min: 1 },
    resolutionTimeMinutes: { type: Number, required: true, min: 1 },
    warningThresholdPercent: { type: Number, default: 80, min: 1, max: 100 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

slaPolicySchema.index({ department: 1, priority: 1, isActive: 1 }, { unique: true });

export const SLAPolicy = mongoose.model<ISLAPolicy>('SLAPolicy', slaPolicySchema);
```

### 2.2 Model — `src/models/SLATracker.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { SLAStatus } from '../constants';

export interface ISLATracker extends Document {
  ticket: Types.ObjectId;
  slaPolicy: Types.ObjectId;
  responseDeadline: Date;
  resolutionDeadline: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  status: SLAStatus;
  warningSentAt?: Date;
  breachedAt?: Date;
  breachReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const slaTrackerSchema = new Schema<ISLATracker>(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    slaPolicy: { type: Schema.Types.ObjectId, ref: 'SLAPolicy', required: true },
    responseDeadline: { type: Date, required: true },
    resolutionDeadline: { type: Date, required: true },
    firstResponseAt: { type: Date },
    resolvedAt: { type: Date },
    status: { type: String, enum: Object.values(SLAStatus), default: SLAStatus.ACTIVE },
    warningSentAt: { type: Date },
    breachedAt: { type: Date },
    breachReason: { type: String },
  },
  { timestamps: true }
);

slaTrackerSchema.index({ ticket: 1 });
slaTrackerSchema.index({ status: 1, resolutionDeadline: 1 });
slaTrackerSchema.index({ status: 1, responseDeadline: 1 });

export const SLATracker = mongoose.model<ISLATracker>('SLATracker', slaTrackerSchema);
```

### 2.3 Repository — `src/repositories/sla.repository.ts` (NEW FILE)

```typescript
import { FilterQuery, UpdateQuery } from 'mongoose';
import { SLAPolicy, ISLAPolicy } from '../models/SLAPolicy.model';
import { SLATracker, ISLATracker } from '../models/SLATracker.model';

export class SLAPolicyRepository {
  async create(data: Partial<ISLAPolicy>): Promise<ISLAPolicy> { ... }
  async findById(id: string): Promise<ISLAPolicy | null> { ... }
  async findByDepartmentAndPriority(dept: Department, priority: TicketPriority): Promise<ISLAPolicy | null> { ... }
  async findAll(filter?: FilterQuery<ISLAPolicy>): Promise<ISLAPolicy[]> { ... }
  async updateById(id: string, data: UpdateQuery<ISLAPolicy>): Promise<ISLAPolicy | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}

export class SLATrackerRepository {
  async create(data: Partial<ISLATracker>): Promise<ISLATracker> { ... }
  async findByTicketId(ticketId: string): Promise<ISLATracker | null> { ... }
  async findBreached(): Promise<ISLATracker[]> { ... }
  async findWarningsDue(): Promise<ISLATracker[]> { ... }
  async updateById(id: string, data: UpdateQuery<ISLATracker>): Promise<ISLATracker | null> { ... }
  async getSLAStats(filters?: { department?: Department; dateRange?: { start: Date; end: Date } }): Promise<SLAStatsResult> { ... }
}

export interface SLAStatsResult {
  total: number;
  met: number;
  breached: number;
  warning: number;
  active: number;
  avgResponseTimeMinutes: number;
  avgResolutionTimeMinutes: number;
  byDepartment: { department: string; met: number; breached: number }[];
  byPriority: { priority: string; met: number; breached: number }[];
}

export const slaPolicyRepository = new SLAPolicyRepository();
export const slaTrackerRepository = new SLATrackerRepository();
```

### 2.4 Service — `src/services/sla.service.ts` (NEW FILE)

```typescript
export class SLAService {
  // Policy management
  async createPolicy(creatorId: string, input: CreateSLAPolicyInput): Promise<ISLAPolicy>
  async updatePolicy(policyId: string, input: UpdateSLAPolicyInput): Promise<ISLAPolicy>
  async deletePolicy(policyId: string): Promise<void>
  async getPolicies(department?: Department): Promise<ISLAPolicy[]>

  // Tracker management (called internally)
  async createTrackerForTicket(ticketId: string, department: Department, priority: TicketPriority): Promise<ISLATracker | null>
  async recordFirstResponse(ticketId: string): Promise<void>
  async recordResolution(ticketId: string): Promise<void>

  // Cron job method
  async checkSLABreaches(): Promise<{ warnings: number; breaches: number }>

  // Stats
  async getSLAStats(filters?: { department?: Department; dateRange?: { start: Date; end: Date } }): Promise<SLAStatsResult>
}
```

**Business Logic:**
- `createTrackerForTicket`: Looks up active SLAPolicy matching department + priority. If none found, returns null (no SLA tracking). Computes deadlines from `createdAt + responseTimeMinutes` and `createdAt + resolutionTimeMinutes`.
- `recordFirstResponse`: Called from CommentService when a staff member (not ticket owner) adds the first comment. Sets `firstResponseAt`, updates status to `MET` if before deadline.
- `recordResolution`: Called from TicketService when status changes to RESOLVED/CLOSED. Sets `resolvedAt`, updates status.
- `checkSLABreaches`: Cron job that runs every 5 minutes. Queries active trackers, checks if current time exceeds warning threshold or deadline. Emits `SLA_BREACH_WARNING` and `SLA_BREACHED` socket events. Sends notifications to assignee and admins.

### 2.5 Controller — `src/controllers/sla.controller.ts` (NEW FILE)

```typescript
export const createSLAPolicy = asyncHandler(async (req, res) => { ... });
export const updateSLAPolicy = asyncHandler(async (req, res) => { ... });
export const deleteSLAPolicy = asyncHandler(async (req, res) => { ... });
export const getSLAPolicies = asyncHandler(async (req, res) => { ... });
export const getSLAStats = asyncHandler(async (req, res) => { ... });
export const getTicketSLA = asyncHandler(async (req, res) => { ... });
```

### 2.6 Routes — `src/routes/sla.routes.ts` (NEW FILE)

```
POST   /api/v1/sla/policies          (admin only)     — Create SLA policy
GET    /api/v1/sla/policies          (admin only)     — List SLA policies
PATCH  /api/v1/sla/policies/:id      (admin only)     — Update SLA policy
DELETE /api/v1/sla/policies/:id      (admin only)     — Delete SLA policy
GET    /api/v1/sla/stats             (staff only)     — SLA dashboard stats
GET    /api/v1/sla/tickets/:id       (staff only)     — Get SLA status for ticket
```

### 2.7 Zod Validators — `src/validators/sla.validators.ts` (NEW FILE)

```typescript
export const createSLAPolicySchema = z.object({
  name: z.string().min(1).max(100),
  department: z.nativeEnum(Department),
  priority: z.nativeEnum(TicketPriority),
  responseTimeMinutes: z.number().int().positive(),
  resolutionTimeMinutes: z.number().int().positive(),
  warningThresholdPercent: z.number().min(1).max(100).optional(),
});

export const updateSLAPolicySchema = createSLAPolicySchema.partial();

export const slaStatsQuerySchema = z.object({
  department: z.nativeEnum(Department).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```

### 2.8 Integration Points

- **TicketService.createTicket**: After ticket creation, call `slaService.createTrackerForTicket(ticketId, department, priority)`.
- **CommentService.addComment**: After staff comment, call `slaService.recordFirstResponse(ticketId)`.
- **TicketService.updateStatus**: When status → RESOLVED/CLOSED, call `slaService.recordResolution(ticketId)`.
- **server.ts**: Start `startSLACheckJob()` alongside the overdue reminder.
- **routes/index.ts**: Add `router.use('/sla', slaRoutes)`.

### 2.9 Cron Job — `src/jobs/slaCheck.job.ts` (NEW FILE)

Runs every 5 minutes. Calls `slaService.checkSLABreaches()`. Logs results.

---

## 3. Ticket Tags & Labels

### 3.1 Model — `src/models/Tag.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITag extends Document {
  name: string;
  slug: string;
  color: string;       // hex color for UI, e.g. '#FF5722'
  description?: string;
  createdBy: Types.ObjectId;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    color: { type: String, default: '#607D8B', match: /^#[0-9A-Fa-f]{6}$/ },
    description: { type: String, maxlength: 200 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tagSchema.index({ name: 1 });
tagSchema.index({ slug: 1 });

export const Tag = mongoose.model<ITag>('Tag', tagSchema);
```

### 3.2 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts` — add `tags` field:

```typescript
// Add to ITicket interface:
tags: Types.ObjectId[];

// Add to ticketSchema:
tags: {
  type: [Schema.Types.ObjectId],
  ref: 'Tag',
  default: [],
},
```

Add index: `ticketSchema.index({ tags: 1 });`

### 3.3 Repository — `src/repositories/tag.repository.ts` (NEW FILE)

```typescript
export class TagRepository {
  async create(data: Partial<ITag>): Promise<ITag> { ... }
  async findById(id: string): Promise<ITag | null> { ... }
  async findBySlug(slug: string): Promise<ITag | null> { ... }
  async findOrCreate(name: string, createdBy: string): Promise<ITag> { ... }
  async findAll(filter?: { search?: string }): Promise<ITag[]> { ... }
  async incrementUsage(tagIds: string[]): Promise<void> { ... }
  async decrementUsage(tagIds: string[]): Promise<void> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}
```

### 3.4 Service — `src/services/tag.service.ts` (NEW FILE)

```typescript
export class TagService {
  async createTag(creatorId: string, input: CreateTagInput): Promise<ITag>
  async getTags(search?: string): Promise<ITag[]>
  async deleteTag(tagId: string): Promise<void>

  // Internal (called from ticket service)
  async setTicketTags(ticketId: string, tagNames: string[], userId: string): Promise<void>
  async getTicketsByTag(tagId: string, options: PaginationOptions): Promise<{ tickets: ITicket[]; total: number }>
}
```

**Business Logic:**
- `setTicketTags`: Creates any missing tags via `findOrCreate`, replaces the ticket's tag array, increments/decrements usage counts. Emits `TAG_UPDATED` socket event.
- `getTicketsByTag`: Queries tickets filtered by tag ID with pagination.

### 3.5 Controller — `src/controllers/tag.controller.ts` (NEW FILE)

```typescript
export const createTag = asyncHandler(async (req, res) => { ... });
export const getTags = asyncHandler(async (req, res) => { ... });
export const deleteTag = asyncHandler(async (req, res) => { ... });
export const getTicketsByTag = asyncHandler(async (req, res) => { ... });
```

### 3.6 Routes — `src/routes/tag.routes.ts` (NEW FILE)

```
POST   /api/v1/tags               (staff only)      — Create tag
GET    /api/v1/tags               (authenticated)   — List tags (with optional ?search=)
DELETE /api/v1/tags/:id           (admin only)       — Delete tag
GET    /api/v1/tags/:id/tickets   (staff only)       — Get tickets by tag
```

### 3.7 Zod Validators — `src/validators/tag.validators.ts` (NEW FILE)

```typescript
export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

export const setTicketTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).max(10),
});
```

### 3.8 Integration Points

- **TicketService.createTicket**: Accept optional `tags: string[]` in input, call `tagService.setTicketTags()`.
- **TicketService.updateTicket**: Accept optional `tags: string[]` update.
- **Ticket routes**: Add `PATCH /:id/tags` endpoint to update tags on existing ticket.
- **TicketQueryOptions**: Add `tagId?: string` filter.
- **routes/index.ts**: Add `router.use('/tags', tagRoutes)`.

---

## 4. Internal Notes

### 4.1 Model Modification — `src/models/Comment.model.ts`

**MODIFY** existing Comment model to add `isInternal` flag:

```typescript
export interface IComment extends Document {
  ticket: Types.ObjectId;
  sender: Types.ObjectId;
  message: string;
  isInternal: boolean;  // NEW: true = staff-only note, false = public comment
  createdAt: Date;
}

// Add to commentSchema:
isInternal: {
  type: Boolean,
  default: false,
},
```

Add index: `commentSchema.index({ ticket: 1, isInternal: 1, createdAt: 1 });`

### 4.2 Repository Changes — `src/repositories/comment.repository.ts`

**MODIFY** to add:

```typescript
async findByTicketIdPublic(ticketId: string): Promise<IComment[]> {
  // Returns only isInternal: false comments
  return Comment.find({ ticket: ticketId, isInternal: false })
    .populate('sender', 'name email role')
    .sort({ createdAt: 1 })
    .exec();
}

async findByTicketIdInternal(ticketId: string): Promise<IComment[]> {
  // Returns only isInternal: true comments (staff only)
  return Comment.find({ ticket: ticketId, isInternal: true })
    .populate('sender', 'name email role')
    .sort({ createdAt: 1 })
    .exec();
}
```

### 4.3 Service Changes — `src/services/comment.service.ts`

**MODIFY** `addComment` method:
- Accept `isInternal?: boolean` in input. If `isInternal`, only staff (ADMIN, SUPPORT_AGENT) can create.
- Modify `getComments` to return public comments to users, all comments (public + internal) to staff.

**MODIFY** `getComments` method:
```typescript
async getComments(ticketId: string, requesterId: string, requesterRole: UserRole) {
  const isStaff = [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(requesterRole);

  if (isStaff) {
    return commentRepository.findByTicketId(ticketId); // all
  }
  return commentRepository.findByTicketIdPublic(ticketId); // public only
}
```

### 4.4 Zod Validator Changes — `src/validators/index.ts`

**MODIFY** `createCommentSchema`:
```typescript
export const createCommentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
  isInternal: z.boolean().optional().default(false),
});
```

### 4.5 Socket Events

- `NOTE_ADDED`: Emitted when an internal note is added. Only broadcast to `staff` room.

### 4.6 Integration Points

- **Ticket detail response**: Include a `notesCount` field (count of internal notes) for staff.
- **Ticket routes**: Existing `POST /:id/comments` and `GET /:id/comments` endpoints handle both — no new routes needed. The `isInternal` flag in the request body distinguishes notes from comments.
- **Notification**: Internal notes do NOT send notifications to the ticket owner. Only emit socket event to staff room.

---

## 5. Ticket Merging

### 5.1 Model — `src/models/TicketMerge.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { MergeStatus } from '../constants';

export interface ITicketMerge extends Document {
  primaryTicket: Types.ObjectId;     // the surviving ticket
  mergedTickets: Types.ObjectId[];   // tickets that were merged into primary
  mergedBy: Types.ObjectId;
  status: MergeStatus;
  reason?: string;
  mergedAt: Date;
  revertedAt?: Date;
  createdAt: Date;
}

const ticketMergeSchema = new Schema<ITicketMerge>(
  {
    primaryTicket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    mergedTickets: [{ type: Schema.Types.ObjectId, ref: 'Ticket', required: true }],
    mergedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(MergeStatus), default: MergeStatus.COMPLETED },
    reason: { type: String, maxlength: 500 },
    mergedAt: { type: Date, default: Date.now },
    revertedAt: { type: Date },
  },
  { timestamps: true }
);

ticketMergeSchema.index({ primaryTicket: 1 });
ticketMergeSchema.index({ mergedTickets: 1 });

export const TicketMerge = mongoose.model<ITicketMerge>('TicketMerge', ticketMergeSchema);
```

### 5.2 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts` — add merge tracking fields:

```typescript
// Add to ITicket interface:
mergedInto?: Types.ObjectId;        // if this ticket was merged, points to primary
isMerged: boolean;                   // true if this ticket's content was merged elsewhere
mergedFrom?: Types.ObjectId[];      // tickets merged into this one

// Add to ticketSchema:
mergedInto: {
  type: Schema.Types.ObjectId,
  ref: 'Ticket',
},
isMerged: {
  type: Boolean,
  default: false,
},
mergedFrom: [{
  type: Schema.Types.ObjectId,
  ref: 'Ticket',
}],
```

### 5.3 Repository — `src/repositories/merge.repository.ts` (NEW FILE)

```typescript
export class MergeRepository {
  async create(data: Partial<ITicketMerge>): Promise<ITicketMerge> { ... }
  async findById(id: string): Promise<ITicketMerge | null> { ... }
  async findByPrimaryTicket(ticketId: string): Promise<ITicketMerge | null> { ... }
  async findByMergedTicket(ticketId: string): Promise<ITicketMerge | null> { ... }
  async revertMerge(mergeId: string): Promise<ITicketMerge | null> { ... }
}
```

### 5.4 Service — `src/services/merge.service.ts` (NEW FILE)

```typescript
export class MergeService {
  async mergeTickets(
    primaryTicketId: string,
    mergedTicketIds: string[],
    mergedBy: string,
    reason?: string
  ): Promise<ITicketMerge>

  async revertMerge(mergeId: string, revertedBy: string): Promise<void>

  async getMergeHistory(ticketId: string): Promise<ITicketMerge | null>

  async linkRelated(ticketId: string, relatedTicketIds: string[]): Promise<void>
}
```

**Business Logic:**
- `mergeTickets`: 
  1. Validates all tickets exist, none are already merged, primary is not in mergedTicketIds.
  2. Moves all comments from merged tickets to primary ticket.
  3. Moves all attachments from merged tickets to primary ticket.
  4. Marks merged tickets with `isMerged: true`, `mergedInto: primaryTicketId`.
  5. Updates primary ticket with `mergedFrom: mergedTicketIds`.
  6. Creates TicketMerge record.
  7. Emits `TICKET_MERGED` socket event.
  8. Notifies primary ticket owner.
- `revertMerge`: Reverses the merge operation (restores comments, attachments, resets flags).

### 5.5 Controller — `src/controllers/merge.controller.ts` (NEW FILE)

```typescript
export const mergeTickets = asyncHandler(async (req, res) => { ... });
export const revertMerge = asyncHandler(async (req, res) => { ... });
export const getMergeHistory = asyncHandler(async (req, res) => { ... });
```

### 5.6 Routes — `src/routes/merge.routes.ts` (NEW FILE)

```
POST   /api/v1/tickets/merge             (staff only)    — Merge tickets
POST   /api/v1/tickets/:id/unmerge       (staff only)    — Revert merge
GET    /api/v1/tickets/:id/merge-history  (staff only)    — Get merge history
```

### 5.7 Zod Validators — `src/validators/merge.validators.ts` (NEW FILE)

```typescript
export const mergeTicketsSchema = z.object({
  primaryTicketId: z.string().min(1),
  mergedTicketIds: z.array(z.string().min(1)).min(1).max(20),
  reason: z.string().max(500).optional(),
});
```

### 5.8 Integration Points

- **TicketService.getTicketById**: If ticket has `isMerged: true`, optionally include redirect info to `mergedInto` ticket.
- **Ticket query results**: Filter out `isMerged: true` tickets from default listing (or add a `merged` query param).
- **Comment queries on merged tickets**: Redirect to primary ticket's comments.
- **routes/index.ts**: Add `router.use('/tickets', mergeRoutes)` (nested under tickets prefix).

---

## 6. Customer Satisfaction (CSAT)

### 6.1 Model — `src/models/CSAT.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { CSATRating } from '../constants';

export interface ICSAT extends Document {
  ticket: Types.ObjectId;
  user: Types.ObjectId;
  rating: CSATRating;
  feedback?: string;
  respondedAt?: Date;
  createdAt: Date;
}

const csatSchema = new Schema<ICSAT>(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, enum: Object.values(CSATRating), required: true },
    feedback: { type: String, maxlength: 2000 },
    respondedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

csatSchema.index({ ticket: 1 });
csatSchema.index({ user: 1 });
csatSchema.index({ rating: 1, createdAt: -1 });

export const CSAT = mongoose.model<ICSAT>('CSAT', csatSchema);
```

### 6.2 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts` — add CSAT field:

```typescript
// Add to ITicket interface:
csatSubmitted?: boolean;

// Add to ticketSchema:
csatSubmitted: {
  type: Boolean,
  default: false,
},
```

### 6.3 Repository — `src/repositories/csat.repository.ts` (NEW FILE)

```typescript
export class CSATRepository {
  async create(data: Partial<ICSAT>): Promise<ICSAT> { ... }
  async findByTicketId(ticketId: string): Promise<ICSAT | null> { ... }
  async findByUserId(userId: string): Promise<ICSAT[]> { ... }
  async getCSATStats(filters?: { department?: Department; dateRange?: { start: Date; end: Date } }): Promise<CSATStatsResult> { ... }
}

export interface CSATStatsResult {
  totalResponses: number;
  averageRating: number;
  distribution: { rating: number; count: number; percent: number }[];
  responseRate: number;  // % of resolved tickets that got CSAT
  trend: { month: string; avgRating: number; count: number }[];
  byDepartment?: { department: string; avgRating: number; count: number }[];
  byAgent?: { agentId: string; agentName: string; avgRating: number; count: number }[];
}
```

### 6.4 Service — `src/services/csat.service.ts` (NEW FILE)

```typescript
export class CSATService {
  async submitCSAT(
    ticketId: string,
    userId: string,
    input: SubmitCSATInput
  ): Promise<ICSAT>

  async getCSATForTicket(ticketId: string): Promise<ICSAT | null>

  async getCSATStats(filters?: CSATFilters): Promise<CSATStatsResult>

  async canSubmitCSAT(ticketId: string, userId: string): Promise<boolean>
}
```

**Business Logic:**
- `submitCSAT`: Validates ticket exists and is RESOLVED/CLOSED. Validates user is the ticket owner. One CSAT per ticket. Sets `csatSubmitted: true` on ticket. Emits `CSAT_SUBMITTED` socket event. Notifies assignee.
- `canSubmitCSAT`: Returns true if ticket is RESOLVED/CLOSED, user is owner, and no CSAT exists yet.
- `getCSATStats`: Aggregation pipeline for dashboard — average rating, distribution, response rate, trends over time, breakdown by department and agent.

### 6.5 Controller — `src/controllers/csat.controller.ts` (NEW FILE)

```typescript
export const submitCSAT = asyncHandler(async (req, res) => { ... });
export const getCSATForTicket = asyncHandler(async (req, res) => { ... });
export const getCSATStats = asyncHandler(async (req, res) => { ... });
export const checkCSATEligibility = asyncHandler(async (req, res) => { ... });
```

### 6.6 Routes — `src/routes/csat.routes.ts` (NEW FILE)

```
POST   /api/v1/csat/tickets/:id     (authenticated, owner)  — Submit CSAT
GET    /api/v1/csat/tickets/:id     (authenticated)          — Get CSAT for ticket
GET    /api/v1/csat/check/:id       (authenticated)          — Check if CSAT can be submitted
GET    /api/v1/csat/stats            (staff only)             — CSAT dashboard stats
```

### 6.7 Zod Validators — `src/validators/csat.validators.ts` (NEW FILE)

```typescript
export const submitCSATSchema = z.object({
  rating: z.nativeEnum(CSATRating),
  feedback: z.string().max(2000).optional(),
});
```

### 6.8 Email Template Addition — `src/templates/email.templates.ts`

Add CSAT survey email template:
```typescript
export function renderCSATEmail(vars: { ticketNumber: string; name: string; ticketId: string }) {
  // HTML email with 1-5 star rating links
  // Each link goes to: /api/v1/csat/tickets/{ticketId}?rating={1-5}
}
```

### 6.9 Integration Points

- **TicketService.updateStatus**: When status → RESOLVED/CLOSED, trigger CSAT survey email to ticket owner.
- **Ticket model**: Add `csatSubmitted` boolean.
- **Ticket response**: Include `csatSubmitted` and optionally `csat` object (for staff view).
- **routes/index.ts**: Add `router.use('/csat', csatRoutes)`.

---

## 7. Custom Fields

### 7.1 Model — `src/models/CustomField.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { FieldType } from '../constants';

export interface ICustomFieldOption {
  label: string;
  value: string;
}

export interface ICustomField extends Document {
  name: string;
  key: string;           // machine-readable key, e.g. 'order_number'
  type: FieldType;
  category: string;       // which ticket category this field applies to
  options?: ICustomFieldOption[];  // for DROPDOWN type
  defaultValue?: string | number | boolean;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldSchema = new Schema<ICustomField>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: Object.values(FieldType), required: true },
    category: { type: String, required: true, trim: true },
    options: [{
      label: { type: String, required: true },
      value: { type: String, required: true },
    }],
    defaultValue: { type: Schema.Types.Mixed },
    isRequired: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

customFieldSchema.index({ category: 1, isActive: 1 });
customFieldSchema.index({ key: 1 }, { unique: true });

export const CustomField = mongoose.model<ICustomField>('CustomField', customFieldSchema);
```

### 7.2 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts`:

```typescript
// Add to ITicket interface:
customFieldValues: ICustomFieldValue[];

// Add to ticketSchema:
customFieldValues: [{
  field: { type: Schema.Types.ObjectId, ref: 'CustomField', required: true },
  value: { type: Schema.Types.Mixed },
}],
```

### 7.3 Repository — `src/repositories/customField.repository.ts` (NEW FILE)

```typescript
export class CustomFieldRepository {
  async create(data: Partial<ICustomField>): Promise<ICustomField> { ... }
  async findById(id: string): Promise<ICustomField | null> { ... }
  async findByKey(key: string): Promise<ICustomField | null> { ... }
  async findByCategory(category: string): Promise<ICustomField[]> { ... }
  async findAll(): Promise<ICustomField[]> { ... }
  async updateById(id: string, data: UpdateQuery<ICustomField>): Promise<ICustomField | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}
```

### 7.4 Service — `src/services/customField.service.ts` (NEW FILE)

```typescript
export class CustomFieldService {
  async createField(creatorId: string, input: CreateCustomFieldInput): Promise<ICustomField>
  async updateField(fieldId: string, input: UpdateCustomFieldInput): Promise<ICustomField>
  async deleteField(fieldId: string): Promise<void>
  async getFieldsByCategory(category: string): Promise<ICustomField[]>
  async getAllFields(): Promise<ICustomField[]>

  // Internal
  async validateCustomFieldValues(category: string, values: ICustomFieldValue[]): Promise<void>
  async setTicketCustomFields(ticketId: string, values: ICustomFieldValue[]): Promise<void>
}
```

**Business Logic:**
- `validateCustomFieldValues`: Fetches all active custom fields for the category. Checks required fields are present. Validates types (dropdown value in options, date is valid date string, etc.).
- `setTicketCustomFields`: Called from TicketService when creating/updating ticket with custom fields. Validates, then saves to ticket's `customFieldValues` array.

### 7.5 Controller — `src/controllers/customField.controller.ts` (NEW FILE)

```typescript
export const createCustomField = asyncHandler(async (req, res) => { ... });
export const updateCustomField = asyncHandler(async (req, res) => { ... });
export const deleteCustomField = asyncHandler(async (req, res) => { ... });
export const getCustomFieldsByCategory = asyncHandler(async (req, res) => { ... });
export const getAllCustomFields = asyncHandler(async (req, res) => { ... });
```

### 7.6 Routes — `src/routes/customField.routes.ts` (NEW FILE)

```
POST   /api/v1/custom-fields                    (admin only)    — Create custom field
GET    /api/v1/custom-fields                    (staff only)    — List all custom fields
GET    /api/v1/custom-fields/category/:category (authenticated) — Fields for category
PATCH  /api/v1/custom-fields/:id                (admin only)    — Update custom field
DELETE /api/v1/custom-fields/:id                (admin only)    — Delete custom field
```

### 7.7 Zod Validators — `src/validators/customField.validators.ts` (NEW FILE)

```typescript
const customFieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const createCustomFieldSchema = z.object({
  name: z.string().min(1).max(100),
  key: z.string().min(1).max(50).regex(/^[a-z_]+$/, 'Key must be lowercase with underscores only'),
  type: z.nativeEnum(FieldType),
  category: z.string().min(1),
  options: z.array(customFieldOptionSchema).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateCustomFieldSchema = createCustomFieldSchema.partial().omit({ key: true });
```

### 7.8 Integration Points

- **TicketService.createTicket**: Accept `customFieldValues: ICustomFieldValue[]`. Validate against category's fields. Store on ticket.
- **TicketService.getTicketById**: Populate `customFieldValues.field` with field definitions.
- **Ticket creation form**: Frontend fetches `GET /custom-fields/category/:category` to render dynamic fields.
- **routes/index.ts**: Add `router.use('/custom-fields', customFieldRoutes)`.

---

## 8. Multi-Department Routing

### 8.1 Model — `src/models/Department.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { Department } from '../constants';

export interface IDepartment extends Document {
  name: Department;
  displayName: string;
  description?: string;
  email?: string;          // department email for routing
  categoryMapping: string[];  // ticket categories that map to this department
  autoAssign: boolean;     // whether to auto-assign tickets to this dept
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, enum: Object.values(Department), required: true, unique: true },
    displayName: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500 },
    email: { type: String },
    categoryMapping: [{ type: String, trim: true }],
    autoAssign: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

departmentSchema.index({ name: 1 }, { unique: true });
departmentSchema.index({ categoryMapping: 1 });

export const DepartmentModel = mongoose.model<IDepartment>('Department', departmentSchema);
```

### 8.2 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts`:

```typescript
// Add to ITicket interface:
department?: Department;

// Add to ticketSchema:
department: {
  type: String,
  enum: Object.values(Department),
},
```

Add index: `ticketSchema.index({ department: 1 });`

### 8.3 Repository — `src/repositories/department.repository.ts` (NEW FILE)

```typescript
export class DepartmentRepository {
  async create(data: Partial<IDepartment>): Promise<IDepartment> { ... }
  async findById(id: string): Promise<IDepartment | null> { ... }
  async findByName(name: Department): Promise<IDepartment | null> { ... }
  async findByCategory(category: string): Promise<IDepartment | null> { ... }
  async findAll(): Promise<IDepartment[]> { ... }
  async updateById(id: string, data: UpdateQuery<IDepartment>): Promise<IDepartment | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}
```

### 8.4 Service — `src/services/department.service.ts` (NEW FILE)

```typescript
export class DepartmentService {
  async createDepartment(creatorId: string, input: CreateDepartmentInput): Promise<IDepartment>
  async updateDepartment(deptId: string, input: UpdateDepartmentInput): Promise<IDepartment>
  async deleteDepartment(deptId: string): Promise<void>
  async getDepartments(): Promise<IDepartment[]>

  // Internal routing logic
  async routeTicket(ticketId: string, category: string): Promise<Department | null>

  // Agent management
  async getDepartmentAgents(department: Department): Promise<IUser[]>
  async assignTicketToDepartment(ticketId: string, department: Department): Promise<void>
}
```

**Business Logic:**
- `routeTicket`: Given a category, looks up departments by `categoryMapping`. If found, sets `ticket.department = matchedDept.name`, emits `DEPARTMENT_ASSIGNED`, and optionally triggers auto-assignment (Feature 9).
- `assignTicketToDepartment`: Sets ticket's department and notifies department agents.
- Default category mappings (seeded):
  - BILLING: ['billing', 'payment', 'refund', 'invoice', 'subscription']
  - TECH_SUPPORT: ['bug', 'technical', 'error', 'crash', 'performance']
  - SALES: ['sales', 'demo', 'pricing', 'partnership']
  - GENERAL: all others

### 8.5 Controller — `src/controllers/department.controller.ts` (NEW FILE)

```typescript
export const createDepartment = asyncHandler(async (req, res) => { ... });
export const updateDepartment = asyncHandler(async (req, res) => { ... });
export const deleteDepartment = asyncHandler(async (req, res) => { ... });
export const getDepartments = asyncHandler(async (req, res) => { ... });
export const getDepartmentAgents = asyncHandler(async (req, res) => { ... });
```

### 8.6 Routes — `src/routes/department.routes.ts` (NEW FILE)

```
POST   /api/v1/departments             (admin only)    — Create department
GET    /api/v1/departments             (authenticated)  — List departments
PATCH  /api/v1/departments/:id         (admin only)    — Update department
DELETE /api/v1/departments/:id         (admin only)    — Delete department
GET    /api/v1/departments/:name/agents (staff only)    — Get agents in department
```

### 8.7 Zod Validators — `src/validators/department.validators.ts` (NEW FILE)

```typescript
export const createDepartmentSchema = z.object({
  name: z.nativeEnum(Department),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  email: z.string().email().optional(),
  categoryMapping: z.array(z.string().min(1)).optional(),
  autoAssign: z.boolean().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().omit({ name: true });
```

### 8.8 Integration Points

- **TicketService.createTicket**: After creation, call `departmentService.routeTicket(ticketId, category)`.
- **Ticket query**: Add `department` filter to `TicketQueryOptions`.
- **Dashboard stats**: Break down by department.
- **routes/index.ts**: Add `router.use('/departments', departmentRoutes)`.

---

## 9. Knowledge Base Linking

### 9.1 Model — `src/models/KBArticle.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { Department } from '../constants';

export interface IKBArticle extends Document {
  title: string;
  slug: string;
  content: string;
  category: string;
  department: Department;
  tags: string[];
  author: Types.ObjectId;
  isPublished: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  relatedTicketCategories: string[];  // categories this article helps with
  createdAt: Date;
  updatedAt: Date;
}

const kbArticleSchema = new Schema<IKBArticle>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    content: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    department: { type: String, enum: Object.values(Department), required: true },
    tags: [{ type: String, trim: true }],
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    relatedTicketCategories: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

kbArticleSchema.index({ title: 'text', content: 'text', tags: 'text' });
kbArticleSchema.index({ category: 1, isPublished: 1 });
kbArticleSchema.index({ relatedTicketCategories: 1 });

export const KBArticle = mongoose.model<IKBArticle>('KBArticle', kbArticleSchema);
```

### 9.2 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts`:

```typescript
// Add to ITicket interface:
linkedArticles: Types.ObjectId[];

// Add to ticketSchema:
linkedArticles: [{
  type: Schema.Types.ObjectId,
  ref: 'KBArticle',
}],
```

### 9.3 Model — `src/models/TicketArticleLink.model.ts` (NEW FILE)

Tracks which articles were linked when and by whom:

```typescript
export interface ITicketArticleLink extends Document {
  ticket: Types.ObjectId;
  article: Types.ObjectId;
  linkedBy: Types.ObjectId;
  wasAutoSuggested: boolean;
  clickedByUser: boolean;
  createdAt: Date;
}

const ticketArticleLinkSchema = new Schema<ITicketArticleLink>(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    article: { type: Schema.Types.ObjectId, ref: 'KBArticle', required: true },
    linkedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    wasAutoSuggested: { type: Boolean, default: false },
    clickedByUser: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ticketArticleLinkSchema.index({ ticket: 1 });
ticketArticleLinkSchema.index({ article: 1 });

export const TicketArticleLink = mongoose.model<ITicketArticleLink>(
  'TicketArticleLink', ticketArticleLinkSchema
);
```

### 9.4 Repository — `src/repositories/kb.repository.ts` (NEW FILE)

```typescript
export class KBArticleRepository {
  async create(data: Partial<IKBArticle>): Promise<IKBArticle> { ... }
  async findById(id: string): Promise<IKBArticle | null> { ... }
  async findBySlug(slug: string): Promise<IKBArticle | null> { ... }
  async search(query: string, filters?: { category?: string; department?: Department }): Promise<IKBArticle[]> { ... }
  async findByCategory(category: string): Promise<IKBArticle[]> { ... }
  async incrementViewCount(id: string): Promise<void> { ... }
  async updateById(id: string, data: UpdateQuery<IKBArticle>): Promise<IKBArticle | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}

export class TicketArticleLinkRepository {
  async create(data: Partial<ITicketArticleLink>): Promise<ITicketArticleLink> { ... }
  async findByTicketId(ticketId: string): Promise<ITicketArticleLink[]> { ... }
  async markClicked(linkId: string): Promise<void> { ... }
  async getStats(): Promise<{ articleId: string; title: string; linkedCount: number; helpfulCount: number }[]> { ... }
}
```

### 9.5 Service — `src/services/kb.service.ts` (NEW FILE)

```typescript
export class KBService {
  // Article management
  async createArticle(authorId: string, input: CreateKBArticleInput): Promise<IKBArticle>
  async updateArticle(articleId: string, input: UpdateKBArticleInput): Promise<IKBArticle>
  async deleteArticle(articleId: string): Promise<void>
  async getArticle(articleId: string): Promise<IKBArticle>
  async searchArticles(query: string, filters?: KBSearchFilters): Promise<IKBArticle[]>

  // Linking
  async linkArticleToTicket(ticketId: string, articleId: string, linkedBy: string, autoSuggested?: boolean): Promise<void>
  async unlinkArticleFromTicket(ticketId: string, articleId: string): Promise<void>
  async getLinkedArticles(ticketId: string): Promise<IKBArticle[]>
  async markArticleClicked(linkId: string): Promise<void>

  // Auto-suggestion
  async suggestArticles(category: string, title: string, description: string): Promise<IKBArticle[]>
}
```

**Business Logic:**
- `suggestArticles`: Given ticket category + title + description, searches KB by category matching `relatedTicketCategories` and full-text search on title/content. Returns top 3-5 most relevant articles. Called from ticket creation to provide "relevant articles" sidebar.
- `linkArticleToTicket`: Creates TicketArticleLink record, adds article to ticket's `linkedArticles`. Increments article view count.
- `markArticleClicked`: When user clicks a suggested article, marks the link as clicked for analytics.

### 9.6 Controller — `src/controllers/kb.controller.ts` (NEW FILE)

```typescript
export const createArticle = asyncHandler(async (req, res) => { ... });
export const updateArticle = asyncHandler(async (req, res) => { ... });
export const deleteArticle = asyncHandler(async (req, res) => { ... });
export const getArticle = asyncHandler(async (req, res) => { ... });
export const searchArticles = asyncHandler(async (req, res) => { ... });
export const linkArticle = asyncHandler(async (req, res) => { ... });
export const unlinkArticle = asyncHandler(async (req, res) => { ... });
export const getLinkedArticles = asyncHandler(async (req, res) => { ... });
export const suggestArticles = asyncHandler(async (req, res) => { ... });
```

### 9.7 Routes — `src/routes/kb.routes.ts` (NEW FILE)

```
POST   /api/v1/kb/articles               (staff only)      — Create article
GET    /api/v1/kb/articles               (authenticated)   — Search articles
GET    /api/v1/kb/articles/:id           (authenticated)   — Get article
PATCH  /api/v1/kb/articles/:id           (staff only)      — Update article
DELETE /api/v1/kb/articles/:id           (admin only)      — Delete article
POST   /api/v1/kb/tickets/:id/link       (staff only)      — Link article to ticket
DELETE /api/v1/kb/tickets/:id/link/:articleId (staff only) — Unlink article
GET    /api/v1/kb/tickets/:id/linked     (authenticated)   — Get linked articles
POST   /api/v1/kb/suggest                (authenticated)   — Get article suggestions
```

### 9.8 Zod Validators — `src/validators/kb.validators.ts` (NEW FILE)

```typescript
export const createKBArticleSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  category: z.string().min(1),
  department: z.nativeEnum(Department),
  tags: z.array(z.string().max(50)).max(10).optional(),
  relatedTicketCategories: z.array(z.string()).optional(),
});

export const updateKBArticleSchema = createKBArticleSchema.partial();

export const suggestArticlesSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});
```

### 9.9 Integration Points

- **TicketService.createTicket**: After creation, call `kbService.suggestArticles(category, title, description)` and return suggestions in response.
- **Ticket detail**: Include `linkedArticles` in response.
- **routes/index.ts**: Add `router.use('/kb', kbRoutes)`.

---

## 10. Auto-Assignment Rules

### 10.1 Model — `src/models/AssignmentRule.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { AssignmentStrategy, Department } from '../constants';

export interface IAssignmentRule extends Document {
  name: string;
  department: Department;
  strategy: AssignmentStrategy;
  category?: string;           // optional: match specific category
  skillRequired?: string;      // optional: agent must have this skill
  priority?: string;           // optional: match specific priority
  isActive: boolean;
  weight: number;              // for rule priority when multiple match
  lastAssignedIndex: number;   // round-robin counter
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentRuleSchema = new Schema<IAssignmentRule>(
  {
    name: { type: String, required: true, trim: true },
    department: { type: String, enum: Object.values(Department), required: true },
    strategy: { type: String, enum: Object.values(AssignmentStrategy), required: true },
    category: { type: String, trim: true },
    skillRequired: { type: String, trim: true },
    priority: { type: String },
    isActive: { type: Boolean, default: true },
    weight: { type: Number, default: 0 },
    lastAssignedIndex: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

assignmentRuleSchema.index({ department: 1, isActive: 1 });

export const AssignmentRule = mongoose.model<IAssignmentRule>(
  'AssignmentRule', assignmentRuleSchema
);
```

### 10.2 Repository — `src/repositories/assignment.repository.ts` (NEW FILE)

```typescript
export class AssignmentRuleRepository {
  async create(data: Partial<IAssignmentRule>): Promise<IAssignmentRule> { ... }
  async findById(id: string): Promise<IAssignmentRule | null> { ... }
  async findMatchingRules(department: Department, category?: string, priority?: string): Promise<IAssignmentRule[]> { ... }
  async findAll(): Promise<IAssignmentRule[]> { ... }
  async updateById(id: string, data: UpdateQuery<IAssignmentRule>): Promise<IAssignmentRule | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
  async incrementRoundRobin(ruleId: string): Promise<void> { ... }
}
```

### 10.3 Service — `src/services/assignment.service.ts` (NEW FILE)

```typescript
export class AssignmentService {
  // Rule management
  async createRule(creatorId: string, input: CreateAssignmentRuleInput): Promise<IAssignmentRule>
  async updateRule(ruleId: string, input: UpdateAssignmentRuleInput): Promise<IAssignmentRule>
  async deleteRule(ruleId: string): Promise<void>
  async getRules(): Promise<IAssignmentRule[]>

  // Auto-assignment logic
  async autoAssignTicket(ticketId: string, department: Department, category?: string, priority?: string): Promise<IUser | null>
  async executeRoundRobin(rule: IAssignmentRule): Promise<IUser | null>
  async executeLoadBalanced(department: Department): Promise<IUser | null>
  async executeSkillBased(rule: IAssignmentRule): Promise<IUser | null>
  async executeLeastRecentlyAssigned(department: Department): Promise<IUser | null>
}
```

**Business Logic:**
- `autoAssignTicket`: Entry point called from TicketService/DepartmentService. Finds matching rules for the department/category/priority. Picks the highest-weight rule. Executes its strategy. Assigns the ticket. Emits `AUTO_ASSIGNED`.
- `executeRoundRobin`: Gets active agents in department. Uses `lastAssignedIndex` to pick next agent. Increments index.
- `executeLoadBalanced`: Gets active agents in department. Counts each agent's open/in_progress tickets. Assigns to agent with fewest open tickets (below `maxTicketLoad`).
- `executeSkillBased`: Gets agents with matching `skillRequired`. Among those, uses load-balanced selection.
- `executeLeastRecentlyAssigned`: Queries ticket assignment history, assigns to agent who was assigned least recently.

### 10.4 Controller — `src/controllers/assignment.controller.ts` (NEW FILE)

```typescript
export const createAssignmentRule = asyncHandler(async (req, res) => { ... });
export const updateAssignmentRule = asyncHandler(async (req, res) => { ... });
export const deleteAssignmentRule = asyncHandler(async (req, res) => { ... });
export const getAssignmentRules = asyncHandler(async (req, res) => { ... });
export const triggerAutoAssign = asyncHandler(async (req, res) => { ... });  // manual trigger for staff
```

### 10.5 Routes — `src/routes/assignment.routes.ts` (NEW FILE)

```
POST   /api/v1/assignments/rules         (admin only)    — Create rule
GET    /api/v1/assignments/rules         (admin only)    — List rules
PATCH  /api/v1/assignments/rules/:id     (admin only)    — Update rule
DELETE /api/v1/assignments/rules/:id     (admin only)    — Delete rule
POST   /api/v1/assignments/auto/:ticketId (staff only)   — Manual auto-assign trigger
```

### 10.6 Zod Validators — `src/validators/assignment.validators.ts` (NEW FILE)

```typescript
export const createAssignmentRuleSchema = z.object({
  name: z.string().min(1).max(100),
  department: z.nativeEnum(Department),
  strategy: z.nativeEnum(AssignmentStrategy),
  category: z.string().optional(),
  skillRequired: z.string().optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  weight: z.number().int().min(0).optional(),
});

export const updateAssignmentRuleSchema = createAssignmentRuleSchema.partial();
```

### 10.7 Integration Points

- **DepartmentService.routeTicket**: After routing to department, if department has `autoAssign: true`, call `assignmentService.autoAssignTicket()`.
- **TicketService.createTicket**: After department routing, trigger auto-assignment if no manual assign.
- **Ticket routes**: Existing `PATCH /:id/assign` remains for manual override.
- **routes/index.ts**: Add `router.use('/assignments', assignmentRoutes)`.

---

## 11. Ticket Canned Responses

### 11.1 Model — `src/models/CannedResponse.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { Department } from '../constants';

export interface ICannedResponse extends Document {
  title: string;
  shortcut: string;           // e.g. '/greeting', '/resolved'
  content: string;
  category: string;
  department?: Department;    // null = available to all depts
  createdBy: Types.ObjectId;
  isGlobal: boolean;          // true = available to all agents
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const cannedResponseSchema = new Schema<ICannedResponse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    shortcut: { type: String, required: true, unique: true, lowercase: true, match: /^\/[a-z0-9_-]+$/ },
    content: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true },
    department: { type: String, enum: Object.values(Department) },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isGlobal: { type: Boolean, default: false },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cannedResponseSchema.index({ shortcut: 1 }, { unique: true });
cannedResponseSchema.index({ department: 1, isGlobal: 1 });

export const CannedResponse = mongoose.model<ICannedResponse>(
  'CannedResponse', cannedResponseSchema
);
```

### 11.2 Repository — `src/repositories/cannedResponse.repository.ts` (NEW FILE)

```typescript
export class CannedResponseRepository {
  async create(data: Partial<ICannedResponse>): Promise<ICannedResponse> { ... }
  async findById(id: string): Promise<ICannedResponse | null> { ... }
  async findByShortcut(shortcut: string): Promise<ICannedResponse | null> { ... }
  async findByAgent(agentId: string, department?: Department): Promise<ICannedResponse[]> { ... }
  async findAll(department?: Department): Promise<ICannedResponse[]> { ... }
  async incrementUsage(id: string): Promise<void> { ... }
  async updateById(id: string, data: UpdateQuery<ICannedResponse>): Promise<ICannedResponse | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}
```

### 11.3 Service — `src/services/cannedResponse.service.ts` (NEW FILE)

```typescript
export class CannedResponseService {
  async createResponse(creatorId: string, input: CreateCannedResponseInput): Promise<ICannedResponse>
  async updateResponse(responseId: string, input: UpdateCannedResponseInput): Promise<ICannedResponse>
  async deleteResponse(responseId: string): Promise<void>
  async getResponses(agentId: string, department?: Department): Promise<ICannedResponse[]>
  async getByShortcut(shortcut: string): Promise<ICannedResponse | null>

  // When agent uses a canned response in a comment
  async useResponse(responseId: string): Promise<ICannedResponse>
}
```

**Business Logic:**
- `getResponses`: Returns global responses + agent's department-specific responses.
- `getByShortcut`: Looks up by shortcut string (e.g. `/greeting`), increments usage count.
- `useResponse`: Increments usage count, emits `CANNED_RESPONSE_USED`.

### 11.4 Controller — `src/controllers/cannedResponse.controller.ts` (NEW FILE)

```typescript
export const createCannedResponse = asyncHandler(async (req, res) => { ... });
export const updateCannedResponse = asyncHandler(async (req, res) => { ... });
export const deleteCannedResponse = asyncHandler(async (req, res) => { ... });
export const getCannedResponses = asyncHandler(async (req, res) => { ... });
```

### 11.5 Routes — `src/routes/cannedResponse.routes.ts` (NEW FILE)

```
POST   /api/v1/canned-responses         (staff only)    — Create canned response
GET    /api/v1/canned-responses         (staff only)    — List canned responses
PATCH  /api/v1/canned-responses/:id     (staff only)    — Update canned response
DELETE /api/v1/canned-responses/:id     (admin only)    — Delete canned response
GET    /api/v1/canned-responses/lookup/:shortcut (staff only) — Get by shortcut
```

### 11.6 Zod Validators — `src/validators/cannedResponse.validators.ts` (NEW FILE)

```typescript
export const createCannedResponseSchema = z.object({
  title: z.string().min(1).max(100),
  shortcut: z.string().regex(/^\/[a-z0-9_-]+$/, 'Shortcut must start with / and contain lowercase alphanumeric, underscores, or hyphens'),
  content: z.string().min(1).max(5000),
  category: z.string().min(1),
  department: z.nativeEnum(Department).optional(),
  isGlobal: z.boolean().optional(),
});

export const updateCannedResponseSchema = createCannedResponseSchema.partial();
```

### 11.7 Integration Points

- **CommentService.addComment**: Check if message matches a canned response shortcut (e.g. starts with `/`). If so, expand to full content before saving.
- **routes/index.ts**: Add `router.use('/canned-responses', cannedResponseRoutes)`.

---

## 12. Escalation Rules

### 12.1 Model — `src/models/EscalationRule.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { EscalationTrigger, EscalationLevel, Department, TicketPriority } from '../constants';

export interface IEscalationCondition {
  trigger: EscalationTrigger;
  thresholdMinutes?: number;   // for TIME_BASED: minutes before escalating
  thresholdPriority?: TicketPriority;  // for PRIORITY_BASED
  noResponseMinutes?: number;  // for NO_RESPONSE: minutes of no staff response
}

export interface IEscalationAction {
  level: EscalationLevel;
  escalateToRole: UserRole;        // escalate to this role
  escalateToDepartment?: Department; // or specific department
  notifyUserIds?: Types.ObjectId[];  // specific users to notify
  autoReassign: boolean;            // reassign to next-level agent
}

export interface IEscalationRule extends Document {
  name: string;
  department: Department;
  conditions: IEscalationCondition[];
  actions: IEscalationAction[];
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const escalationRuleSchema = new Schema<IEscalationRule>(
  {
    name: { type: String, required: true, trim: true },
    department: { type: String, enum: Object.values(Department), required: true },
    conditions: [{
      trigger: { type: String, enum: Object.values(EscalationTrigger), required: true },
      thresholdMinutes: { type: Number },
      thresholdPriority: { type: String, enum: Object.values(TicketPriority) },
      noResponseMinutes: { type: Number },
    }],
    actions: [{
      level: { type: String, enum: Object.values(EscalationLevel), required: true },
      escalateToRole: { type: String, enum: Object.values(UserRole), required: true },
      escalateToDepartment: { type: String, enum: Object.values(Department) },
      notifyUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      autoReassign: { type: Boolean, default: false },
    }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

escalationRuleSchema.index({ department: 1, isActive: 1 });

export const EscalationRule = mongoose.model<IEscalationRule>(
  'EscalationRule', escalationRuleSchema
);
```

### 12.2 Model — `src/models/EscalationLog.model.ts` (NEW FILE)

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { EscalationLevel, EscalationTrigger } from '../constants';

export interface IEscalationLog extends Document {
  ticket: Types.ObjectId;
  rule: Types.ObjectId;
  level: EscalationLevel;
  triggeredBy: EscalationTrigger;
  reason: string;
  escalatedTo?: Types.ObjectId;
  previousAssignee?: Types.ObjectId;
  newAssignee?: Types.ObjectId;
  createdAt: Date;
}

const escalationLogSchema = new Schema<IEscalationLog>(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    rule: { type: Schema.Types.ObjectId, ref: 'EscalationRule', required: true },
    level: { type: String, enum: Object.values(EscalationLevel), required: true },
    triggeredBy: { type: String, enum: Object.values(EscalationTrigger), required: true },
    reason: { type: String, required: true },
    escalatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    previousAssignee: { type: Schema.Types.ObjectId, ref: 'User' },
    newAssignee: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

escalationLogSchema.index({ ticket: 1, createdAt: -1 });

export const EscalationLog = mongoose.model<IEscalationLog>(
  'EscalationLog', escalationLogSchema
);
```

### 12.3 Ticket Model Modification

**MODIFY** `src/models/Ticket.model.ts`:

```typescript
// Add to ITicket interface:
escalationLevel: EscalationLevel;
lastEscalatedAt?: Date;

// Add to ticketSchema:
escalationLevel: {
  type: String,
  enum: Object.values(EscalationLevel),
  default: EscalationLevel.NONE,
},
lastEscalatedAt: { type: Date },
```

### 12.4 Repository — `src/repositories/escalation.repository.ts` (NEW FILE)

```typescript
export class EscalationRuleRepository {
  async create(data: Partial<IEscalationRule>): Promise<IEscalationRule> { ... }
  async findById(id: string): Promise<IEscalationRule | null> { ... }
  async findMatchingRules(department: Department): Promise<IEscalationRule[]> { ... }
  async findAll(): Promise<IEscalationRule[]> { ... }
  async updateById(id: string, data: UpdateQuery<IEscalationRule>): Promise<IEscalationRule | null> { ... }
  async deleteById(id: string): Promise<boolean> { ... }
}

export class EscalationLogRepository {
  async create(data: Partial<IEscalationLog>): Promise<IEscalationLog> { ... }
  async findByTicketId(ticketId: string): Promise<IEscalationLog[]> { ... }
  async findRecentByTicket(ticketId: string): Promise<IEscalationLog | null> { ... }
}
```

### 12.5 Service — `src/services/escalation.service.ts` (NEW FILE)

```typescript
export class EscalationService {
  // Rule management
  async createRule(creatorId: string, input: CreateEscalationRuleInput): Promise<IEscalationRule>
  async updateRule(ruleId: string, input: UpdateEscalationRuleInput): Promise<IEscalationRule>
  async deleteRule(ruleId: string): Promise<void>
  async getRules(department?: Department): Promise<IEscalationRule[]>

  // Escalation execution
  async evaluateAndEscalate(ticketId: string): Promise<void>
  async triggerTimeBasedEscalation(ticket: ITicket): Promise<void>
  async triggerPriorityBasedEscalation(ticket: ITicket): Promise<void>
  async triggerSLABreachEscalation(ticket: ITicket): Promise<void>

  // Cron job
  async checkEscalations(): Promise<{ escalated: number; errors: number }>

  // History
  async getEscalationHistory(ticketId: string): Promise<IEscalationLog[]>
}
```

**Business Logic:**
- `checkEscalations` (cron): Runs every 5 minutes. For each open/in_progress ticket:
  1. Find matching escalation rules for the ticket's department.
  2. Evaluate conditions:
     - `TIME_BASED`: Check if ticket age > thresholdMinutes AND no escalation at current level yet.
     - `PRIORITY_BASED`: Check if priority matches threshold.
     - `SLA_BREACH`: Check if SLA tracker status is BREACHED.
     - `NO_RESPONSE`: Check if time since last staff comment > noResponseMinutes AND no escalation at this level yet.
  3. Execute actions: Notify escalateToRole members, optionally auto-reassign, log escalation.
  4. Emits `ESCALATION_TRIGGERED` socket event.
- **Dedup**: Before escalating, check `EscalationLog` to see if this rule+level has already been applied to this ticket.

### 12.6 Controller — `src/controllers/escalation.controller.ts` (NEW FILE)

```typescript
export const createEscalationRule = asyncHandler(async (req, res) => { ... });
export const updateEscalationRule = asyncHandler(async (req, res) => { ... });
export const deleteEscalationRule = asyncHandler(async (req, res) => { ... });
export const getEscalationRules = asyncHandler(async (req, res) => { ... });
export const getEscalationHistory = asyncHandler(async (req, res) => { ... });
export const triggerEscalation = asyncHandler(async (req, res) => { ... });  // manual trigger
```

### 12.7 Routes — `src/routes/escalation.routes.ts` (NEW FILE)

```
POST   /api/v1/escalations/rules          (admin only)    — Create rule
GET    /api/v1/escalations/rules          (admin only)    — List rules
PATCH  /api/v1/escalations/rules/:id      (admin only)    — Update rule
DELETE /api/v1/escalations/rules/:id      (admin only)    — Delete rule
GET    /api/v1/escalations/tickets/:id/history (staff only) — Escalation history
POST   /api/v1/escalations/tickets/:id/trigger (staff only) — Manual escalation trigger
```

### 12.8 Zod Validators — `src/validators/escalation.validators.ts` (NEW FILE)

```typescript
const escalationConditionSchema = z.object({
  trigger: z.nativeEnum(EscalationTrigger),
  thresholdMinutes: z.number().int().positive().optional(),
  thresholdPriority: z.nativeEnum(TicketPriority).optional(),
  noResponseMinutes: z.number().int().positive().optional(),
}).refine(
  (data) => {
    if (data.trigger === EscalationTrigger.TIME_BASED) return !!data.thresholdMinutes;
    if (data.trigger === EscalationTrigger.PRIORITY_BASED) return !!data.thresholdPriority;
    if (data.trigger === EscalationTrigger.NO_RESPONSE) return !!data.noResponseMinutes;
    return true;
  },
  { message: 'Missing threshold for trigger type' }
);

const escalationActionSchema = z.object({
  level: z.nativeEnum(EscalationLevel),
  escalateToRole: z.nativeEnum(UserRole),
  escalateToDepartment: z.nativeEnum(Department).optional(),
  notifyUserIds: z.array(z.string()).optional(),
  autoReassign: z.boolean().optional(),
});

export const createEscalationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  department: z.nativeEnum(Department),
  conditions: z.array(escalationConditionSchema).min(1),
  actions: z.array(escalationActionSchema).min(1),
});

export const updateEscalationRuleSchema = createEscalationRuleSchema.partial();
```

### 12.9 Integration Points

- **server.ts**: Start `startEscalationCheckJob()` cron alongside others.
- **SLA breach** (Feature 1): When SLA breaches, call `escalationService.triggerSLABreachEscalation()`.
- **overdueReminder.job.ts**: After marking overdue, also trigger escalation evaluation.
- **Ticket detail**: Include `escalationLevel` and escalation history (staff only).
- **routes/index.ts**: Add `router.use('/escalations', escalationRoutes)`.

---

## 13. Feature Interaction Matrix

| Feature | Interacts With | How |
|---------|---------------|-----|
| SLA Mgmt | Escalation Rules | SLA breach triggers escalation |
| SLA Mgmt | Ticket Status | First response / resolution timestamps tracked |
| Tags | Ticket Queries | Filter tickets by tag |
| Tags | Department Routing | Tags can influence routing rules |
| Internal Notes | CSAT | Notes not visible to customers |
| Ticket Merging | All Features | Merged tickets inherit primary's SLA, tags, department |
| CSAT | Ticket Status | Only available for RESOLVED/CLOSED |
| CSAT | Department Routing | CSAT stats broken down by department |
| Custom Fields | Department Routing | Fields are per-category, routing is per-category |
| KB Linking | Auto-Assignment | Articles suggest based on category (from routing) |
| Auto-Assignment | Department Routing | Assignment happens after department routing |
| Escalation | SLA Mgmt | SLA breach escalation |
| Escalation | Auto-Assignment | Escalated tickets may be auto-reassigned |
| Canned Responses | Internal Notes | Can use shortcuts for notes too (staff only) |
| All Features | User Model | User gains `department`, `skills`, `isActive` fields |

---

## 14. Migration Strategy

### 14.1 Schema Migration (Backward-Compatible)

All new fields on existing models use **optional/default values** so existing documents are unaffected:

- `Ticket`: Add `tags: []`, `department: undefined`, `customFieldValues: []`, `linkedArticles: []`, `mergedInto: undefined`, `isMerged: false`, `mergedFrom: []`, `csatSubmitted: false`, `escalationLevel: 'NONE'`, `lastEscalatedAt: undefined`
- `User`: Add `department: undefined`, `skills: []`, `isActive: true`, `maxTicketLoad: 20`
- `Comment`: Add `isInternal: false`

### 14.2 Seed Data

Create `src/scripts/seed.ts`:

```typescript
// Run once: npx tsx src/scripts/seed.ts
// Seeds:
// 1. Default departments (BILLING, TECH_SUPPORT, SALES, GENERAL) with category mappings
// 2. Default SLA policies (response/resolution times per dept+priority)
// 3. Default escalation rules (time-based L1→L2→L3)
// 4. Sample canned responses (/greeting, /resolved, /escalated)
```

### 14.3 Migration Scripts

Create `src/scripts/migrate-legacy-tickets.ts`:
```typescript
// For existing tickets without department:
// 1. Match ticket.category against Department.categoryMapping
// 2. Set ticket.department = matched department
// 3. For unmatched tickets, set department = GENERAL
```

### 14.4 Deployment Steps

1. Deploy code with all new models (no breaking changes — all new fields optional)
2. Run seed script for default departments, SLA policies, escalation rules
3. Run migration script to assign departments to existing tickets
4. Start new cron jobs (SLA check, escalation check)
5. New routes are additive — existing API unchanged

---

## 15. Database Indexes

### New Indexes to Create

```typescript
// Ticket model (additional)
ticketSchema.index({ tags: 1 });
ticketSchema.index({ department: 1, status: 1 });
ticketSchema.index({ department: 1, priority: 1 });
ticketSchema.index({ isMerged: 1 });
ticketSchema.index({ mergedInto: 1 });
ticketSchema.index({ escalationLevel: 1 });

// User model (additional)
userSchema.index({ department: 1, role: 1, isActive: 1 });
userSchema.index({ skills: 1 });

// Comment model (additional)
commentSchema.index({ ticket: 1, isInternal: 1, createdAt: 1 });

// SLA Policy
slaPolicySchema.index({ department: 1, priority: 1, isActive: 1 }, { unique: true });

// SLA Tracker
slaTrackerSchema.index({ status: 1, resolutionDeadline: 1 });
slaTrackerSchema.index({ status: 1, responseDeadline: 1 });

// Tag
tagSchema.index({ name: 1 }, { unique: true });

// CSAT
csatSchema.index({ rating: 1, createdAt: -1 });

// Custom Field
customFieldSchema.index({ category: 1, isActive: 1 });

// Department
departmentSchema.index({ categoryMapping: 1 });

// KB Article
kbArticleSchema.index({ title: 'text', content: 'text', tags: 'text' });
kbArticleSchema.index({ relatedTicketCategories: 1 });

// Assignment Rule
assignmentRuleSchema.index({ department: 1, isActive: 1 });

// Canned Response
cannedResponseSchema.index({ shortcut: 1 }, { unique: true });

// Escalation Rule
escalationRuleSchema.index({ department: 1, isActive: 1 });

// Escalation Log
escalationLogSchema.index({ ticket: 1, createdAt: -1 });

// Ticket Merge
ticketMergeSchema.index({ primaryTicket: 1 });
ticketMergeSchema.index({ mergedTickets: 1 });

// Ticket Article Link
ticketArticleLinkSchema.index({ ticket: 1 });
ticketArticleLinkSchema.index({ article: 1 });
```

---

## 16. Implementation Order

### Phase 1: Foundation (Features with minimal dependencies)
1. **Multi-Department Routing** — adds Department model, modifies User + Ticket, needed by many features
2. **Ticket Tags & Labels** — simple addition to Ticket, no external dependencies
3. **Internal Notes** — minimal change to Comment model

### Phase 2: Service Layer (Features that enhance core workflows)
4. **SLA Management** — depends on Department routing
5. **Canned Responses** — standalone, agent productivity tool
6. **Custom Fields** — depends on categories (used by department routing)
7. **Knowledge Base Linking** — standalone, enriches ticket creation

### Phase 3: Automation (Features with cron jobs / complex logic)
8. **Auto-Assignment Rules** — depends on Department + User.department + User.skills
9. **Escalation Rules** — depends on SLA, Department, Auto-Assignment
10. **Ticket Merging** — complex, depends on Comment/Attachment system being stable

### Phase 4: Feedback (User-facing features)
11. **Customer Satisfaction (CSAT)** — depends on Ticket status workflow being complete

### Phase 5: Integration & Polish
12. Update `server.ts` to start all new cron jobs
13. Update `routes/index.ts` to register all new routers
14. Update `src/models/index.ts` to export all new models
15. Run seed scripts for default data
16. Run migration scripts for legacy data
17. Full integration testing
18. Swagger documentation audit

---

## Complete File Manifest

### New Files (44 files)

**Models (10)**
- `src/models/SLAPolicy.model.ts`
- `src/models/SLATracker.model.ts`
- `src/models/Tag.model.ts`
- `src/models/TicketMerge.model.ts`
- `src/models/CSAT.model.ts`
- `src/models/CustomField.model.ts`
- `src/models/Department.model.ts`
- `src/models/KBArticle.model.ts`
- `src/models/TicketArticleLink.model.ts`
- `src/models/AssignmentRule.model.ts`
- `src/models/CannedResponse.model.ts`
- `src/models/EscalationRule.model.ts`
- `src/models/EscalationLog.model.ts`

**Repositories (8)**
- `src/repositories/sla.repository.ts`
- `src/repositories/tag.repository.ts`
- `src/repositories/merge.repository.ts`
- `src/repositories/csat.repository.ts`
- `src/repositories/customField.repository.ts`
- `src/repositories/department.repository.ts`
- `src/repositories/kb.repository.ts`
- `src/repositories/assignment.repository.ts`
- `src/repositories/cannedResponse.repository.ts`
- `src/repositories/escalation.repository.ts`

**Services (8)**
- `src/services/sla.service.ts`
- `src/services/tag.service.ts`
- `src/services/merge.service.ts`
- `src/services/csat.service.ts`
- `src/services/customField.service.ts`
- `src/services/department.service.ts`
- `src/services/kb.service.ts`
- `src/services/assignment.service.ts`
- `src/services/cannedResponse.service.ts`
- `src/services/escalation.service.ts`

**Controllers (8)**
- `src/controllers/sla.controller.ts`
- `src/controllers/tag.controller.ts`
- `src/controllers/merge.controller.ts`
- `src/controllers/csat.controller.ts`
- `src/controllers/customField.controller.ts`
- `src/controllers/department.controller.ts`
- `src/controllers/kb.controller.ts`
- `src/controllers/assignment.controller.ts`
- `src/controllers/cannedResponse.controller.ts`
- `src/controllers/escalation.controller.ts`

**Routes (8)**
- `src/routes/sla.routes.ts`
- `src/routes/tag.routes.ts`
- `src/routes/merge.routes.ts`
- `src/routes/csat.routes.ts`
- `src/routes/customField.routes.ts`
- `src/routes/department.routes.ts`
- `src/routes/kb.routes.ts`
- `src/routes/assignment.routes.ts`
- `src/routes/cannedResponse.routes.ts`
- `src/routes/escalation.routes.ts`

**Validators (8)**
- `src/validators/sla.validators.ts`
- `src/validators/tag.validators.ts`
- `src/validators/merge.validators.ts`
- `src/validators/csat.validators.ts`
- `src/validators/customField.validators.ts`
- `src/validators/department.validators.ts`
- `src/validators/kb.validators.ts`
- `src/validators/assignment.validators.ts`
- `src/validators/cannedResponse.validators.ts`
- `src/validators/escalation.validators.ts`

**Jobs (2)**
- `src/jobs/slaCheck.job.ts`
- `src/jobs/escalationCheck.job.ts`

**Scripts (2)**
- `src/scripts/seed.ts`
- `src/scripts/migrate-legacy-tickets.ts`

### Modified Files (10)

- `src/constants/index.ts` — Add new enums, expand SOCKET_EVENTS
- `src/interfaces/index.ts` — Add new interfaces
- `src/models/Ticket.model.ts` — Add tags, department, customFieldValues, linkedArticles, merge fields, CSAT, escalation fields
- `src/models/User.model.ts` — Add department, skills, isActive, maxTicketLoad
- `src/models/Comment.model.ts` — Add isInternal field
- `src/models/index.ts` — Export all new models
- `src/repositories/comment.repository.ts` — Add public-only and internal-only queries
- `src/services/comment.service.ts` — Handle isInternal notes, SLA first-response tracking
- `src/services/ticket.service.ts` — Integrate department routing, auto-assignment, SLA tracker creation, tags, custom fields
- `src/validators/index.ts` — Add isInternal to createCommentSchema
- `src/routes/index.ts` — Register all new routers
- `src/routes/ticket.routes.ts` — Add PATCH /:id/tags endpoint
- `src/server.ts` — Start SLA check and escalation check cron jobs
- `src/sockets/index.ts` — No structural changes (events emitted from services)
