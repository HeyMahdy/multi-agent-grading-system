import { assignmentPaths } from '../docs/assignment.openapi.js';
import { questionPaths } from '../docs/question.openapi.js';
import { rubricPaths } from '../docs/rubrics.openapi.js';
import { solutionPaths } from '../docs/solution.openapi.js';
import { studentPaths } from '../docs/student.openapi.js';
import { studentAnswerPaths } from '../docs/studentAnswer.openapi.js';
import { gradingPaths } from '../docs/grading.openapi.js';
import { syllabusPaths } from '../docs/syllabus.openapi.js';
import { taChatPaths } from '../docs/taChat.openapi.js';
import { taContextPaths } from '../docs/taContext.openapi.js';

const profileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    display_name: { type: 'string', nullable: true },
  },
  required: ['id', 'email', 'display_name'],
} as const;

const authTokenSchema = {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    token_type: { type: 'string', example: 'Bearer' },
    user: profileSchema,
  },
  required: ['access_token', 'token_type', 'user'],
} as const;

const errorSchema = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
} as const;

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Assess AI API',
    version: '1.0.0',
    description:
      'Auth uses local JWT tokens. Protected routes send `Authorization: Bearer <access_token>`.',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token.',
      },
    },
  },
  paths: {
    ...assignmentPaths,
    ...questionPaths,
    ...rubricPaths,
    ...solutionPaths,
    ...studentPaths,
    ...studentAnswerPaths,
    ...gradingPaths,
    ...syllabusPaths,
    ...taChatPaths,
    ...taContextPaths,
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                  required: ['status', 'timestamp'],
                },
              },
            },
          },
        },
      },
    },
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Sign up with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                  display_name: { type: 'string', maxLength: 200 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created',
            content: {
              'application/json': {
                schema: authTokenSchema,
              },
            },
          },
          '400': {
            description: 'Validation or signup error',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Email/password login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'JWT session',
            content: { 'application/json': { schema: authTokenSchema } },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get my profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile',
            content: { 'application/json': { schema: profileSchema } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: errorSchema } },
          },
          '404': {
            description: 'Profile missing',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update my profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  display_name: { type: 'string', nullable: true, maxLength: 200 },
                },
                additionalProperties: false,
                minProperties: 1,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated profile',
            content: { 'application/json': { schema: profileSchema } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: errorSchema } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: errorSchema } },
          },
        },
      },
    },
  },
};
