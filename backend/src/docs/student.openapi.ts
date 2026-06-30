const studentSchema = {
  type: 'object',
  properties: {
    teacher_id: { type: 'string', format: 'uuid' },
    id: { type: 'string', format: 'uuid' },
    student_id: { type: 'string' },
    name: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
  },
  required: ['teacher_id', 'id', 'student_id', 'name'],
} as const;

const studentErrorSchema = {
  type: 'object',
  properties: { 
    error: { type: 'string' },
    details: { type: 'string', nullable: true }
  },
  required: ['error'],
} as const;

const studentAssignmentMarksSchema = {
  type: 'object',
  properties: {
    assignment_id: { type: 'integer' },
    title: { type: 'string' },
    subject: { type: 'string', nullable: true },
    assignment_total_marks: { type: 'number', nullable: true },
    marks_obtained: { type: 'number' },
    graded_question_count: { type: 'integer' },
    created_at: { type: 'string', format: 'date-time' },
  },
  required: [
    'assignment_id',
    'title',
    'assignment_total_marks',
    'marks_obtained',
    'graded_question_count',
    'created_at',
  ],
} as const;

export const studentPaths: Record<string, any> = {
  '/students': {
    post: {
      tags: ['Students'],
      summary: 'Add a new student',
      description: 'Creates a new student record for the authenticated teacher.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['student_id', 'name'],
              properties: {
                student_id: { 
                  type: 'string',
                  description: 'Teacher-facing student identifier (e.g., student ID number)'
                },
                name: { 
                  type: 'string',
                  description: 'Full name of the student'
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Student added successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: studentSchema,
                },
                required: ['message', 'data'],
              },
            },
          },
        },
        '400': {
          description: 'Bad Request: Missing required fields',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '409': {
          description: 'Conflict: Student with this ID already exists',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
    get: {
      tags: ['Students'],
      summary: 'Get all students for the authenticated teacher',
      description: 'Retrieves all students belonging to the authenticated teacher.',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Students retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  count: { type: 'integer' },
                  data: {
                    type: 'array',
                    items: studentSchema,
                  },
                },
                required: ['message', 'count', 'data'],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
  },
  '/students/search': {
    get: {
      tags: ['Students'],
      summary: 'Search students by ID or name',
      description: 'Searches students belonging to the authenticated teacher using case-insensitive partial matches on student_id and/or name.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'student_id',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Partial or full teacher-facing student identifier',
        },
        {
          name: 'name',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Partial or full student name',
        },
      ],
      responses: {
        '200': {
          description: 'Students retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  count: { type: 'integer' },
                  data: {
                    type: 'array',
                    items: studentSchema,
                  },
                },
                required: ['message', 'count', 'data'],
              },
            },
          },
        },
        '400': {
          description: 'Bad Request: Missing search query',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
  },
  '/students/{studentId}': {
    get: {
      tags: ['Students'],
      summary: 'Get a specific student by ID',
      description: 'Retrieves a specific student belonging to the authenticated teacher.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'studentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The teacher-facing student identifier, not the student UUID primary key',
        },
      ],
      responses: {
        '200': {
          description: 'Student retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: studentSchema,
                },
                required: ['message', 'data'],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '404': {
          description: 'Not Found: Student not found or unauthorized',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
    patch: {
      tags: ['Students'],
      summary: 'Update a student\'s information',
      description: 'Updates a specific student belonging to the authenticated teacher.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'studentId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'The student UUID primary key',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                student_id: { 
                  type: 'string',
                  description: 'Updated teacher-facing student identifier'
                },
                name: { 
                  type: 'string',
                  description: 'Updated full name of the student'
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Student updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: studentSchema,
                },
                required: ['message', 'data'],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '404': {
          description: 'Not Found: Student not found or unauthorized',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
    delete: {
      tags: ['Students'],
      summary: 'Delete a student',
      description: 'Deletes a specific student belonging to the authenticated teacher.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'studentId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'The student UUID primary key',
        },
      ],
      responses: {
        '200': {
          description: 'Student deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: studentSchema,
                },
                required: ['message', 'data'],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '404': {
          description: 'Not Found: Student not found or unauthorized',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
  },
  '/students/{studentId}/assignments': {
    get: {
      tags: ['Students'],
      summary: 'Get a student\'s assignments with marks',
      description: 'Retrieves every assignment owned by the authenticated teacher and the total marks this student received for each assignment. Ungraded assignments return 0 marks.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'studentId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'The student UUID primary key',
        },
      ],
      responses: {
        '200': {
          description: 'Student assignment marks retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  student: studentSchema,
                  data: {
                    type: 'array',
                    items: studentAssignmentMarksSchema,
                  },
                },
                required: ['message', 'student', 'data'],
              },
              example: {
                message: 'Student assignment marks retrieved successfully',
                student: {
                  teacher_id: '7d0d2c5f-3b95-4f43-8fd6-19a2939b7a13',
                  id: '84e2c2b8-f5a4-4e34-943b-1ef82f804d9c',
                  student_id: 'S-1001',
                  name: 'Student Name',
                  created_at: '2026-05-30T10:00:00.000Z',
                },
                data: [
                  {
                    assignment_id: 12,
                    title: 'Physics Assignment',
                    subject: 'Physics',
                    assignment_total_marks: 50,
                    marks_obtained: 42.5,
                    graded_question_count: 5,
                    created_at: '2026-05-30T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '404': {
          description: 'Not Found: Student not found or unauthorized',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
  },
  '/students/{studentId}/assignment-grades': {
    get: {
      tags: ['Students'],
      summary: 'Get a student\'s graded assignments',
      description: 'Retrieves only assignments where the student has stored grading results. Ungraded assignments are excluded.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'studentId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'The student UUID primary key',
        },
      ],
      responses: {
        '200': {
          description: 'Student assignment grades retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  student: studentSchema,
                  count: { type: 'integer' },
                  data: {
                    type: 'array',
                    items: studentAssignmentMarksSchema,
                  },
                },
                required: ['message', 'student', 'count', 'data'],
              },
              example: {
                message: 'Student assignment grades retrieved successfully',
                student: {
                  teacher_id: '7d0d2c5f-3b95-4f43-8fd6-19a2939b7a13',
                  id: '84e2c2b8-f5a4-4e34-943b-1ef82f804d9c',
                  student_id: 'S-1001',
                  name: 'Student Name',
                  created_at: '2026-05-30T10:00:00.000Z',
                },
                count: 1,
                data: [
                  {
                    assignment_id: 12,
                    title: 'Physics Assignment',
                    subject: 'Physics',
                    assignment_total_marks: 50,
                    marks_obtained: 42.5,
                    graded_question_count: 5,
                    created_at: '2026-05-30T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized: Missing teacher identity',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '404': {
          description: 'Not Found: Student not found or unauthorized',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
        '500': {
          description: 'Internal Server Error: Database error',
          content: { 'application/json': { schema: studentErrorSchema } },
        },
      },
    },
  },
};
