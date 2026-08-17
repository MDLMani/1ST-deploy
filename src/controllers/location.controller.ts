import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { locationService } from '../services/location.service';
import { LocationPlacesQuery, LocationTaluksQuery } from '../validators';

export const listDistricts = asyncHandler(async (_req, res: Response) => {
  const districts = await locationService.listDistricts();
  sendSuccess(res, 'Districts retrieved', districts);
});

export const listTaluks = asyncHandler(async (req, res: Response) => {
  const query = req.query as unknown as LocationTaluksQuery;
  const taluks = await locationService.listTaluks(query.district);
  sendSuccess(res, 'Taluks retrieved', taluks);
});

export const listPlaces = asyncHandler(async (req, res: Response) => {
  const query = req.query as unknown as LocationPlacesQuery;
  const places = await locationService.listPlaces({
    district: query.district,
    taluk: query.taluk,
    q: query.q,
    limit: query.limit,
  });
  sendSuccess(res, 'Places retrieved', places);
});
