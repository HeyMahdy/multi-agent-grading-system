import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { corsMiddleware } from './common/middleware/corsMiddleware.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { helmetMiddleware } from './common/middleware/helmetMiddleware.js';
import { notFoundHandler } from './common/middleware/notFoundHandler.js';
import { rateLimiter } from './common/middleware/rateLimiter.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import { env } from './config/env.js';
import { openApiDocument } from './config/openapi.js';
import { logger } from './lib/logger.js';
import { rootRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(rateLimiter);
  app.use(requestLogger);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(rootRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();

if (env.NODE_ENV !== 'test') {
  app.listen(8080, () => {
    logger.info({ port: env.PORT }, 'server listening');
  });
}
