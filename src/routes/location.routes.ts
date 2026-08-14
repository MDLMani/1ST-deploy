import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { staffOnly } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { listDistricts, listPlaces, listTaluks } from '../controllers/location.controller';
import { locationPlacesQuerySchema, locationTaluksQuerySchema } from '../validators';

const router = Router();

router.use(authenticate, staffOnly);

/**
 * @swagger
 * /api/v1/locations/districts:
 *   get:
 *     tags: [Locations]
 *     summary: List all Tamil Nadu districts (staff)
 */
router.get('/districts', listDistricts);

/**
 * @swagger
 * /api/v1/locations/taluks:
 *   get:
 *     tags: [Locations]
 *     summary: List taluks for a Tamil Nadu district (staff)
 */
router.get('/taluks', validate(locationTaluksQuerySchema, 'query'), listTaluks);

/**
 * @swagger
 * /api/v1/locations/places:
 *   get:
 *     tags: [Locations]
 *     summary: List or search cities / villages / towns in a taluk (staff)
 */
router.get('/places', validate(locationPlacesQuerySchema, 'query'), listPlaces);

export default router;
