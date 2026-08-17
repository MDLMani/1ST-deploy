import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  acceptInvitation,
  approveInvitation,
  completeStaffProfile,
  getManagedUser,
  getManagers,
  getMyOnboarding,
  getPermittedRoles,
  inviteUser,
  keepInvitationPending,
  listAuditEvents,
  listManagedUsers,
  listOverdueUsers,
  rejectInvitation,
  resendInvitation,
  setManagedUserActive,
  verifyInvitation,
} from '../controllers/userManagement.controller';
import {
  acceptInvitationSchema,
  completeStaffProfileSchema,
  inviteUserSchema,
  keepPendingSchema,
  rejectInvitationSchema,
  setUserActiveSchema,
  userManagementListQuerySchema,
} from '../validators';

const router = Router();

/**
 * @swagger
 * /api/v1/user-management/invitations/verify/{token}:
 *   get:
 *     tags: [User Management]
 *     summary: Verify an invitation token (public)
 *     security: []
 */
router.get('/invitations/verify/:token', verifyInvitation);

/**
 * @swagger
 * /api/v1/user-management/invitations/accept:
 *   post:
 *     tags: [User Management]
 *     summary: Accept a staff invitation (public)
 *     security: []
 */
router.post('/invitations/accept', validate(acceptInvitationSchema), acceptInvitation);

router.use(authenticate);

/** Staff onboarding (self-signup after first approval) — not admin-only. */
router.get('/onboarding/me', getMyOnboarding);
router.post('/onboarding/complete-profile', validate(completeStaffProfileSchema), completeStaffProfile);

router.use(adminOnly);

/**
 * @swagger
 * /api/v1/user-management:
 *   get:
 *     tags: [User Management]
 *     summary: List invited org users (admin only)
 */
router.get('/', validate(userManagementListQuerySchema, 'query'), listManagedUsers);

router.get('/overdue', listOverdueUsers);
router.get('/roles', getPermittedRoles);
router.get('/managers', getManagers);
router.get('/audit', listAuditEvents);

router.post('/invitations', validate(inviteUserSchema), inviteUser);
router.post('/invitations/:id/resend', resendInvitation);
router.post('/invitations/:id/approve', approveInvitation);
router.post('/invitations/:id/reject', validate(rejectInvitationSchema), rejectInvitation);
router.post('/invitations/:id/keep-pending', validate(keepPendingSchema), keepInvitationPending);

router.get('/:id', getManagedUser);
router.patch('/users/:id/active', validate(setUserActiveSchema), setManagedUserActive);

export default router;
