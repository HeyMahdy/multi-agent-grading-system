import type { RequestHandler } from 'express';
import { HttpError } from '../common/HttpError.js';
import { updateMyProfileBodySchema } from '../schemas/user.schemas.js';
import * as userService from '../services/user.service.js';

function assertParse<T>(
  parsed: import('zod').SafeParseReturnType<unknown, T>,
): asserts parsed is import('zod').SafeParseSuccess<T> {
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    throw new HttpError(400, msg);
  }
}

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const auth = req.authUser;
    if (!auth?.id) {
      throw new HttpError(401, 'Unauthorized');
    }
    const profile = await userService.getUserById(auth.id);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

export const patchMe: RequestHandler = async (req, res, next) => {
  try {
    const auth = req.authUser;
    if (!auth?.id) {
      throw new HttpError(401, 'Unauthorized');
    }
    const parsed = updateMyProfileBodySchema.safeParse(req.body);
    assertParse(parsed);
    const profile = await userService.updateMyProfile(auth.id, parsed.data);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};
