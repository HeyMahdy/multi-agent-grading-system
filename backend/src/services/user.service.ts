import { HttpError } from '../common/HttpError.js';
import { pool } from '../lib/database.js';
import type { UpdateMyProfileBody } from '../schemas/user.schemas.js';

export interface PublicUserProfile {
  id: string;
  email: string;
  display_name: string | null;
}

export async function getUserById(userId: string): Promise<PublicUserProfile> {
  const result = await pool.query(
    'SELECT id, email, display_name FROM users WHERE id = $1',
    [userId],
  );
  const row = result.rows[0] as PublicUserProfile | undefined;
  if (!row) {
    throw new HttpError(404, 'User not found');
  }
  return row;
}

export async function updateMyProfile(
  userId: string,
  body: UpdateMyProfileBody,
): Promise<PublicUserProfile> {
  if (body.display_name === undefined) {
    throw new HttpError(400, 'At least one field is required');
  }

  const result = await pool.query(
    'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, email, display_name',
    [body.display_name, userId],
  );
  const row = result.rows[0] as PublicUserProfile | undefined;
  if (!row) {
    throw new HttpError(404, 'User not found');
  }
  return row;
}
