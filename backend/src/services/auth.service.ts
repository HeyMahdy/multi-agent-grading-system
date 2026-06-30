import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HttpError } from '../common/HttpError.js';
import { env } from '../config/env.js';
import { pool } from '../lib/database.js';
import type { LoginBody, SignupBody } from '../schemas/auth.schemas.js';

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  user: {
    id: string;
    email: string;
    display_name: string | null;
  };
}

function signAccessToken(user: AuthTokenResponse['user']) {
  if (!env.JWT_SECRET) {
    throw new HttpError(500, 'JWT secret is not configured');
  }
  const expiresIn = (env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  const signOptions = { expiresIn } as jwt.SignOptions;
  return jwt.sign(
    { sub: user.id, email: user.email, display_name: user.display_name },
    env.JWT_SECRET,
    signOptions,
  );
}

export async function signup(body: SignupBody): Promise<AuthTokenResponse> {
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rows.length > 0) {
      throw new HttpError(409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [body.email, passwordHash, body.display_name ?? null],
    );
    const user = result.rows[0] as AuthTokenResponse['user'];
    const accessToken = signAccessToken(user);
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      user,
    };
  } catch (err) {
    console.error('signup failed', err);
    throw err;
  }
}

export async function login(body: LoginBody): Promise<AuthTokenResponse> {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [body.email],
    );
    const row = result.rows[0] as
      | (AuthTokenResponse['user'] & { password_hash: string })
      | undefined;
    if (!row) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const match = await bcrypt.compare(body.password, row.password_hash);
    if (!match) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const user = { id: row.id, email: row.email, display_name: row.display_name };
    const accessToken = signAccessToken(user);
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      user,
    };
  } catch (err) {
    console.error('login failed', err);
    throw err;
  }
}
