import { z } from 'zod';
import {
  AccessLevel,
  DEFAULT_PARTY,
  DepartmentRole,
  UserRole,
  TicketPriority,
  TicketStatus,
  AssignmentStrategy,
  EscalationTrigger,
} from '../constants';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128),
  role: z.nativeEnum(UserRole).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const formJson = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, schema);

export const createTicketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(2, 'Category is required'),
  customCategory: z.string().min(2, 'Custom category must be at least 2 characters').max(120).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  department: z.string().min(1, 'Department is required'),
  district: z.string().max(80).optional(),
  taluk: z.string().max(80).optional(),
  city: z.string().max(120).optional(),
  tags: formJson(z.array(z.string()).optional()),
  customFields: formJson(z.record(z.string(), z.any()).optional()),
  isInternal: z.boolean().optional(),
  identityFullName: z.string().min(2).max(120).optional(),
  identityFatherName: z.string().min(2).max(120).optional(),
  identityIdType: z.string().min(2).max(40).optional(),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
});

export const assignTicketSchema = z.object({
  assignedTo: z.string().min(1, 'Assignee user ID is required'),
});

export const createCommentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  overdue: z.enum(['true', 'false']).optional().transform((val) => (val === undefined ? undefined : val === 'true')),
  department: z.string().optional(),
  tags: z.string().optional().transform((val) => val ? val.split(',') : undefined),
  dateFrom: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  dateTo: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  priority: z.nativeEnum(TicketPriority).optional(),
  search: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

// Department
export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  defaultPriority: z.nativeEnum(TicketPriority).optional(),
  assignmentStrategy: z.nativeEnum(AssignmentStrategy).optional(),
  slaPolicy: z.object({
    responseTimeHours: z.record(z.nativeEnum(TicketPriority), z.number().positive()),
    resolutionTimeHours: z.record(z.nativeEnum(TicketPriority), z.number().positive()),
  }).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  defaultPriority: z.nativeEnum(TicketPriority).optional(),
  assignmentStrategy: z.nativeEnum(AssignmentStrategy).optional(),
  slaPolicy: z.object({
    responseTimeHours: z.record(z.nativeEnum(TicketPriority), z.number().positive()),
    resolutionTimeHours: z.record(z.nativeEnum(TicketPriority), z.number().positive()),
  }).optional(),
  isActive: z.boolean().optional(),
});

// Tag
export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Canned Response
export const createCannedResponseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  content: z.string().min(1, 'Content is required').max(5000),
  shortcut: z.string().min(1, 'Shortcut is required').max(50).regex(/^\//, 'Shortcut must start with /'),
  category: z.string().min(1, 'Category is required'),
  department: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

export const updateCannedResponseSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(5000).optional(),
  shortcut: z.string().min(1).max(50).regex(/^\//).optional(),
  category: z.string().min(1).optional(),
  department: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

// Knowledge Base
export const createArticleSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).optional(),
  department: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const updateArticleSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(10).optional(),
  category: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  department: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const searchArticleSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

// Custom Field
export const createCustomFieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  key: z.string().min(1, 'Key is required').max(100).regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase alphanumeric with underscores'),
  type: z.enum(['text', 'number', 'select', 'multi_select', 'date', 'boolean']),
  options: z.array(z.string()).optional(),
  department: z.string().optional(),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const reorderCustomFieldsSchema = z.object({
  fields: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int(),
  })),
});

// Escalation Rule
export const createEscalationRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  trigger: z.nativeEnum(EscalationTrigger),
  conditions: z.object({
    department: z.string().optional(),
    priority: z.array(z.nativeEnum(TicketPriority)).optional(),
    status: z.array(z.nativeEnum(TicketStatus)).optional(),
    timeElapsedMinutes: z.number().int().positive().optional(),
    slaMetric: z.enum(['response', 'resolution']).optional(),
  }),
  actions: z.object({
    assignTo: z.string().optional(),
    changePriority: z.nativeEnum(TicketPriority).optional(),
    addTag: z.string().optional(),
    notifyUsers: z.array(z.string()).optional(),
    notifyRoles: z.array(z.nativeEnum(UserRole)).optional(),
  }),
  isActive: z.boolean().optional(),
});

export const updateEscalationRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  trigger: z.nativeEnum(EscalationTrigger).optional(),
  conditions: z.object({
    department: z.string().optional(),
    priority: z.array(z.nativeEnum(TicketPriority)).optional(),
    status: z.array(z.nativeEnum(TicketStatus)).optional(),
    timeElapsedMinutes: z.number().int().positive().optional(),
    slaMetric: z.enum(['response', 'resolution']).optional(),
  }).optional(),
  actions: z.object({
    assignTo: z.string().optional(),
    changePriority: z.nativeEnum(TicketPriority).optional(),
    addTag: z.string().optional(),
    notifyUsers: z.array(z.string()).optional(),
    notifyRoles: z.array(z.nativeEnum(UserRole)).optional(),
  }).optional(),
  isActive: z.boolean().optional(),
});

// Assignment Rule
export const createAssignmentRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  department: z.string().min(1, 'Department is required'),
  strategy: z.nativeEnum(AssignmentStrategy),
  category: z.string().optional(),
  skillRequired: z.string().optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  weight: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateAssignmentRuleSchema = createAssignmentRuleSchema.partial();

// Satisfaction
export const submitRatingSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5),
  comment: z.string().max(500).optional(),
});

// Merge
export const mergeTicketsSchema = z.object({
  sourceIds: z.array(z.string()).min(1, 'At least one source ticket is required'),
  targetId: z.string().min(1, 'Target ticket ID is required'),
});

export const linkRelatedSchema = z.object({
  relatedIds: z.array(z.string()).min(1, 'At least one related ticket ID is required'),
});

// Comment update for internal notes
export const createInternalNoteSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

// Knowledge base vote
export const voteArticleSchema = z.object({
  helpful: z.boolean(),
});

export type DepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type TagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type CannedResponseInput = z.infer<typeof createCannedResponseSchema>;
export type UpdateCannedResponseInput = z.infer<typeof updateCannedResponseSchema>;
export type ArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type SearchArticleInput = z.infer<typeof searchArticleSchema>;
export type CustomFieldInput = z.infer<typeof createCustomFieldSchema>;
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;
export type ReorderCustomFieldsInput = z.infer<typeof reorderCustomFieldsSchema>;
export type AssignmentRuleInput = z.infer<typeof createAssignmentRuleSchema>;
export type UpdateAssignmentRuleInput = z.infer<typeof updateAssignmentRuleSchema>;
export type EscalationRuleInput = z.infer<typeof createEscalationRuleSchema>;
export type UpdateEscalationRuleInput = z.infer<typeof updateEscalationRuleSchema>;
export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;
export type MergeTicketsInput = z.infer<typeof mergeTicketsSchema>;
export type LinkRelatedInput = z.infer<typeof linkRelatedSchema>;
export type VoteArticleInput = z.infer<typeof voteArticleSchema>;

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const inviteUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone is required').max(30),
  jobTitle: z.string().min(1, 'Job title is required').max(120),
  department: objectId,
  company: z.string().min(1, 'Company / organization is required').max(120),
  district: z.string().min(1, 'District is required').max(80),
  taluk: z.string().min(1, 'Taluk is required').max(80),
  city: z.string().min(1, 'City / village / town is required').max(120),
  partyRole: z.string().min(1, 'Party role is required').max(120),
  party: z.string().min(1, 'Party is required').max(120).default(DEFAULT_PARTY),
  departmentRole: z.nativeEnum(DepartmentRole, {
    errorMap: () => ({ message: 'Department role is required' }),
  }),
  role: z.enum([UserRole.ADMIN, UserRole.SUPPORT_AGENT], {
    errorMap: () => ({ message: 'Role must be admin or support_agent' }),
  }).optional(),
  accessLevel: z.nativeEnum(AccessLevel).optional(),
  reportingManager: objectId.optional().or(z.literal('')),
  additionalInformation: z.string().max(2000).optional(),
}).superRefine((data, ctx) => {
  const expectedRole =
    data.departmentRole === DepartmentRole.DEPARTMENT_ADMIN
      ? UserRole.ADMIN
      : UserRole.SUPPORT_AGENT;
  if (data.role && data.role !== expectedRole) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['role'],
      message: `Role must be ${expectedRole} for the selected department role`,
    });
  }
});

export const completeStaffProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  phone: z.string().min(7, 'Phone is required').max(30),
  jobTitle: z.string().min(1, 'Job title is required').max(120),
  department: objectId,
  company: z.string().min(1, 'Company / organization is required').max(120),
  district: z.string().min(1, 'District is required').max(80),
  taluk: z.string().min(1, 'Taluk is required').max(80),
  city: z.string().min(1, 'City / village / town is required').max(120),
  partyRole: z.string().min(1, 'Party role is required').max(120),
  party: z.string().min(1, 'Party is required').max(120).default(DEFAULT_PARTY),
  departmentRole: z.nativeEnum(DepartmentRole, {
    errorMap: () => ({ message: 'Department role is required' }),
  }),
  accessLevel: z.nativeEnum(AccessLevel).optional(),
  reportingManager: objectId.optional().or(z.literal('')),
  additionalInformation: z.string().max(2000).optional(),
});

export type CompleteStaffProfileInput = z.infer<typeof completeStaffProfileSchema>;

export const rejectInvitationSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const keepPendingSchema = z.object({
  note: z.string().min(1, 'Resolution note is required').max(1000),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16, 'Invitation token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const setUserActiveSchema = z.object({
  isActive: z.boolean(),
});

export const locationTaluksQuerySchema = z.object({
  district: z.string().min(1, 'District is required').max(80),
});

export const locationPlacesQuerySchema = z.object({
  district: z.string().min(1, 'District is required').max(80),
  taluk: z.string().min(1, 'Taluk is required').max(80),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const userManagementListQuerySchema = z.object({
  filter: z
    .enum(['all', 'pending_approval', 'overdue', 'approved', 'rejected', 'active', 'inactive'])
    .optional(),
  search: z.string().optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type RejectInvitationInput = z.infer<typeof rejectInvitationSchema>;
export type KeepPendingInput = z.infer<typeof keepPendingSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;
export type UserManagementListQuery = z.infer<typeof userManagementListQuerySchema>;
export type LocationTaluksQuery = z.infer<typeof locationTaluksQuerySchema>;
export type LocationPlacesQuery = z.infer<typeof locationPlacesQuerySchema>;

const assistantHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(2000),
});

/** Accepts multipart string `"[]"` or JSON body `[]`. */
export const assistantChatSchema = z.object({
  message: z.string().max(4000).optional().default(''),
  locale: z.enum(['en', 'ta']).optional().default('en'),
  history: formJson(z.array(assistantHistoryItemSchema).max(12))
    .optional()
    .default([]),
  /** Optional structured facts (tickets, hints) for the model — not shown as user prose. */
  context: z.string().max(12000).optional().default(''),
});

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  district: z.string().max(80).optional(),
  taluk: z.string().max(80).optional(),
  city: z.string().max(120).optional(),
  ward: z.string().max(120).optional(),
  preferredDepartmentId: z.string().max(64).nullable().optional(),
  identityDefaults: z
    .object({
      fullName: z.string().max(120).optional(),
      fatherName: z.string().max(120).optional(),
      idType: z.string().max(40).optional(),
    })
    .optional(),
  notificationPrefs: z
    .object({
      ticketUpdates: z.boolean().optional(),
      staffReplies: z.boolean().optional(),
      overdue: z.boolean().optional(),
      system: z.boolean().optional(),
    })
    .optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128).optional(),
  })
  .refine(
    (data) => !data.confirmPassword || data.confirmPassword === data.newPassword,
    { message: 'Passwords do not match', path: ['confirmPassword'] }
  );

export const phoneOtpRequestSchema = z.object({
  phone: z.string().min(8).max(30),
});

export const phoneOtpVerifySchema = z.object({
  phone: z.string().min(8).max(30),
  otp: z.string().length(6).regex(/^\d{6}$/),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export const revokeOthersSchema = z.object({
  refreshToken: z.string().optional(),
});

export const savedAddressSchema = z.object({
  label: z.string().min(1).max(80),
  street: z.string().max(200).optional(),
  villageTown: z.string().max(120).optional(),
  taluk: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = savedAddressSchema.partial();

export const familyMemberSchema = z.object({
  name: z.string().min(2).max(120),
  relation: z.string().min(1).max(60),
  phone: z.string().max(30).optional(),
  district: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

export const updateFamilyMemberSchema = familyMemberSchema.partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
