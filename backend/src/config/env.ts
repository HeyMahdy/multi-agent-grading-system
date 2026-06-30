export type Env = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_URL: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
};

export const env = {
  NODE_ENV: (process.env['NODE_ENV'] as Env['NODE_ENV']) ?? 'development',
  PORT: Number(process.env['PORT'] ?? 3000),
  DATABASE_HOST: process.env['DATABASE_HOST'] ?? '',
  DATABASE_PORT: Number(process.env['DATABASE_PORT'] ?? 0),
  DATABASE_NAME: process.env['DATABASE_NAME'] ?? '',
  DATABASE_USER: process.env['DATABASE_USER'] ?? '',
  DATABASE_PASSWORD: process.env['DATABASE_PASSWORD'] ?? '',
  DATABASE_URL: process.env['DATABASE_URL'] ?? '',
  UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'] ?? '',
  UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? '',
  JWT_SECRET: process.env['JWT_SECRET'] ?? '',
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] ?? '7d',
} satisfies Env;
