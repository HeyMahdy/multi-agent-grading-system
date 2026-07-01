const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: { type: 'string', nullable: true },
  },
  required: ['error'],
} as const;

const studentCandidateSchema = {
  type: 'object',
  properties: {
    student_uuid: { type: 'string', format: 'uuid', description: 'Internal machine ID; do not show to teachers' },
    student_id: { type: 'string' },
    name: { type: 'string' },
    created_at: { type: 'string', nullable: true },
    display: { type: 'string' },
  },
} as const;

const assignmentCandidateSchema = {
  type: 'object',
  properties: {
    assignment_id: { type: 'integer' },
    title: { type: 'string' },
    subject: { type: 'string', nullable: true },
    total_marks: { type: 'number', nullable: true },
    created_at: { type: 'string', nullable: true },
    display: { type: 'string' },
  },
} as const;

const syllabusContextSchema = {
  type: 'object',
  nullable: true,
  properties: {
    syllabus_id: { type: 'integer' },
    status: { type: 'string' },
    filename: { type: 'string' },
    entity_count: { type: 'integer', nullable: true },
    relationship_count: { type: 'integer', nullable: true },
    created_at: { type: 'string', nullable: true },
  },
} as const;

export const taContextPaths: Record<string, any> = {
  '/ta/context/resolve': {
    post: {
      tags: ['TA Context'],
      summary: 'Resolve teacher-friendly entity references',
      description: 'Resolves student names/student IDs and assignment titles into scoped machine IDs for TA tools.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                students: { type: 'array', items: { type: 'string' } },
                assignments: { type: 'array', items: { type: 'string' } },
              },
            },
            example: { students: ['Mahdy'], assignments: ['Physics midterm'] },
          },
        },
      },
      responses: {
        '200': {
          description: 'Resolution results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      students: { type: 'array', items: { type: 'object' } },
                      assignments: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
        '400': { description: 'Missing references', content: { 'application/json': { schema: errorSchema } } },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
      },
    },
  },
  '/ta/context/students/{studentRef}/overview': {
    get: {
      tags: ['TA Context'],
      summary: 'Get student overview for TA',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'studentRef', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Student overview', content: { 'application/json': { schema: { type: 'object' } } } },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
        '404': { description: 'Not found or ambiguous', content: { 'application/json': { schema: errorSchema } } },
      },
    },
  },
  '/ta/context/assignments/{assignmentId}/overview': {
    get: {
      tags: ['TA Context'],
      summary: 'Get assignment overview for TA',
      description: 'Includes assignment stats and syllabus ingestion status when a syllabus exists.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'assignmentId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '200': {
          description: 'Assignment overview',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      assignment: assignmentCandidateSchema,
                      syllabus: syllabusContextSchema,
                      stats: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
        '404': { description: 'Not found', content: { 'application/json': { schema: errorSchema } } },
      },
    },
  },
  '/ta/context/students/{studentRef}/assignments/{assignmentId}/performance': {
    get: {
      tags: ['TA Context'],
      summary: 'Get one student performance on one assignment',
      description: 'Returns scores, comments, weaknesses, and syllabus availability for prerequisite-aware TA answers.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'studentRef', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'assignmentId', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      responses: {
        '200': { description: 'Performance context', content: { 'application/json': { schema: { type: 'object' } } } },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
        '404': { description: 'Not found or ambiguous', content: { 'application/json': { schema: errorSchema } } },
      },
    },
  },
  '/ta/context/assignments/{assignmentId}/mistakes': {
    get: {
      tags: ['TA Context'],
      summary: 'Get common assignment mistakes',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'assignmentId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '200': { description: 'Mistake groups', content: { 'application/json': { schema: { type: 'object' } } } },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
      },
    },
  },
  '/ta/context/students/{studentRef}/weak-concepts': {
    get: {
      tags: ['TA Context'],
      summary: 'Get student weak concepts and remediation exercises',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'studentRef', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Weak concepts', content: { 'application/json': { schema: { type: 'object' } } } },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
      },
    },
  },
};

export { studentCandidateSchema, assignmentCandidateSchema };
