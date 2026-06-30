import { Pool } from 'pg';
import { env } from '../config/env.js';

/** Postgres pool. Uses DATABASE_URL; component fields remain on env for tooling and drivers that need them. */
export const pool = new Pool({ connectionString: env.DATABASE_URL });
