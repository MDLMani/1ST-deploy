import { Router } from 'express';
import { getVapidKey, subscribe, unsubscribe, sendTestPush, registerDevice, unregisterDevice, sendTestFcm } from '../controllers/push.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '../validators/push.validators';

const router = Router();

router.get('/vapid-public-key', getVapidKey);

router.use(authenticate);

router.post('/subscribe', validate(pushSubscribeSchema), subscribe);
router.post('/unsubscribe', validate(pushUnsubscribeSchema), unsubscribe);
router.post('/test', sendTestPush);
router.post('/device', registerDevice);
router.post('/device/unregister', unregisterDevice);
router.post('/test-fcm', sendTestFcm);

export default router;
