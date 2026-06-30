const assignmentSchema = {
  type: 'object',
  properties: {
    assignment_id: { type: 'integer' },
    title: { type: 'string' },
    subject: { type: 'string' },
    total_marks: { type: 'number' },
    created_at: { type: 'string', format: 'date-time' },
  },
  required: ['assignment_id', 'title', 'subject', 'total_marks', 'created_at'],
} as const;

const createAssignmentResponseSchema = {
  type: 'object',
  properties: {
    assignment_id: { type: 'integer' },
    message: { type: 'string' },
  },
  required: ['assignment_id', 'message'],
} as const;

const errorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    error: { type: 'string' },
    details: { type: 'string', nullable: true },
  },
} as const;

export const assignmentPaths = {
  '/assignments': {
    get: {
      tags: ['Assignments'],
      summary: 'List assignments',
      description: 'Retrieves all assignments owned by the authenticated teacher.',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Assignments retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  count: { type: 'integer' },
                  data: {
                    type: 'array',
                    items: assignmentSchema,
                  },
                },
                required: ['message', 'count', 'data'],
              },
              example: {
                message: 'Assignments retrieved successfully',
                count: 2,
                data: [
                  {
                    assignment_id: 4,
                    title: 'string',
                    subject: 'string',
                    total_marks: 0,
                    created_at: '2026-05-29T16:48:49.693Z',
                  },
                  {
                    assignment_id: 3,
                    title: 'string',
                    subject: 'string',
                    total_marks: 0,
                    created_at: '2026-05-29T16:37:05.594Z',
                  },
                ],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: { 'application/json': { schema: errorSchema } },
        },
        '500': {
          description: 'Database error',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
    post: {
      tags: ['Assignments'],
      summary: 'Create assignment',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'subject', 'total_marks'],
              properties: {
                title: { type: 'string' },
                subject: { type: 'string' },
                total_marks: { type: 'number' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created assignment',
          content: {
            'application/json': {
              schema: createAssignmentResponseSchema,
              example: {
                assignment_id: 12,
                message: 'Assignment created successfully',
              },
            },
          },
        },
        '400': {
          description: 'Validation error',
          content: { 'application/json': { schema: errorSchema } },
        },
        '500': {
          description: 'Database error',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/assignments/search': {
    get: {
      tags: ['Assignments'],
      summary: 'Search assignments by title',
      description: 'Searches assignments owned by the authenticated teacher using a case-insensitive partial title match.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'title',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Partial or full assignment title to search for',
          example: 'Midterm',
        },
      ],
      responses: {
        '200': {
          description: 'Assignments retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  count: { type: 'integer' },
                  data: {
                    type: 'array',
                    items: assignmentSchema,
                  },
                },
                required: ['message', 'count', 'data'],
              },
              example: {
                message: 'Assignments retrieved successfully',
                count: 1,
                data: [
                  {
                    assignment_id: 12,
                    title: 'Midterm Exam',
                    subject: 'Computer Science',
                    total_marks: 50,
                    created_at: '2026-05-29T16:48:49.693Z',
                  },
                ],
              },
            },
          },
        },
        '400': {
          description: 'Missing title query parameter',
          content: {
            'application/json': {
              schema: errorSchema,
              example: { error: 'title query parameter is required' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: { 'application/json': { schema: errorSchema } },
        },
        '500': {
          description: 'Database error',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/assignments/{assignmentId}': {
    get: {
      tags: ['Assignments'],
      summary: 'Get assignment by id',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'assignmentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Assignment',
          content: { 'application/json': { schema: assignmentSchema } },
        },
        '401': {
          description: 'Unauthorized',
          content: { 'application/json': { schema: errorSchema } },
        },
        '404': {
          description: 'Assignment not found',
          content: { 'application/json': { schema: errorSchema } },
        },
        '500': {
          description: 'Database error',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
    patch: {
      tags: ['Assignments'],
      summary: 'Update assignment',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'assignmentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                subject: { type: 'string' },
                total_marks: { type: 'number' },
              },
              minProperties: 1,
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated assignment',
          content: { 'application/json': { schema: assignmentSchema } },
        },
        '401': {
          description: 'Unauthorized',
          content: { 'application/json': { schema: errorSchema } },
        },
        '404': {
          description: 'Assignment not found',
          content: { 'application/json': { schema: errorSchema } },
        },
        '500': {
          description: 'Database error',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
    delete: {
      tags: ['Assignments'],
      summary: 'Delete assignment',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'assignmentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Assignment deleted successfully',
          content: { 'application/json': { schema: errorSchema } },
        },
        '401': {
          description: 'Unauthorized',
          content: { 'application/json': { schema: errorSchema } },
        },
        '404': {
          description: 'Assignment not found',
          content: { 'application/json': { schema: errorSchema } },
        },
        '409': {
          description: 'Assignment has related data and cannot be deleted yet',
          content: {
            'application/json': {
              schema: errorSchema,
              example: {
                error: 'Assignment cannot be deleted because it still has related data',
                details: 'Delete the related questions, rubrics, solutions, student answers, or grading results first, then try again.',
              },
            },
          },
        },
        '500': {
          description: 'Database error',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
} as const;
