import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  updateProfileSchema,
  changePasswordSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  deleteAccountSchema,
  savedAddressSchema,
  updateAddressSchema,
  familyMemberSchema,
  updateFamilyMemberSchema,
  revokeOthersSchema,
} from '../validators';
import {
  getAccount,
  updateProfile,
  changePassword,
  requestPhoneOtp,
  verifyPhoneOtp,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  deleteAccount,
  exportAccount,
  listAddresses,
  addAddress,
  updateAddress,
  removeAddress,
  listFamily,
  addFamily,
  updateFamily,
  removeFamily,
} from '../controllers/account.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAccount);
router.patch('/profile', validate(updateProfileSchema), updateProfile);
router.post('/change-password', validate(changePasswordSchema), changePassword);

router.post('/phone/request-otp', validate(phoneOtpRequestSchema), requestPhoneOtp);
router.post('/phone/verify-otp', validate(phoneOtpVerifySchema), verifyPhoneOtp);

router.get('/sessions', listSessions);
router.delete('/sessions/:id', revokeSession);
router.post('/sessions/revoke-others', validate(revokeOthersSchema), revokeOtherSessions);

router.delete('/', validate(deleteAccountSchema), deleteAccount);
router.get('/export', exportAccount);

router.get('/addresses', listAddresses);
router.post('/addresses', validate(savedAddressSchema), addAddress);
router.patch('/addresses/:id', validate(updateAddressSchema), updateAddress);
router.delete('/addresses/:id', removeAddress);

router.get('/family', listFamily);
router.post('/family', validate(familyMemberSchema), addFamily);
router.patch('/family/:id', validate(updateFamilyMemberSchema), updateFamily);
router.delete('/family/:id', removeFamily);

export default router;
