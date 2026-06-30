# API Coverage Report

This document maps the required API blueprint to what currently exists in the codebase.

Sources reviewed:
- [backend/src/routes/index.ts](backend/src/routes/index.ts)
- [backend/src/routes/authRoute.ts](backend/src/routes/authRoute.ts)
- [backend/src/routes/userRoute.ts](backend/src/routes/userRoute.ts)
- [backend/src/routes/healthRoute.ts](backend/src/routes/healthRoute.ts)
- [agent/main.py](agent/main.py)

Legend:
- Present: implemented in the codebase right now.
- Missing: not found in codebase.
- Partial: related behavior exists but does not match the requested route.

## AUTH MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/auth/signup` | Present | [backend/src/routes/authRoute.ts](backend/src/routes/authRoute.ts#L6) | Implemented via `auth.signup`. |
| POST `/auth/login` | Present | [backend/src/routes/authRoute.ts](backend/src/routes/authRoute.ts#L7) | Implemented via `auth.login`. |
| POST `/auth/refresh` | Present | [backend/src/routes/authRoute.ts](backend/src/routes/authRoute.ts#L10) | Implemented via `auth.refresh`. |
| POST `/auth/password/forgot` | Present | [backend/src/routes/authRoute.ts](backend/src/routes/authRoute.ts#L8) | Implemented via `auth.passwordForgot`. |
| POST `/auth/password/reset` | Present | [backend/src/routes/authRoute.ts](backend/src/routes/authRoute.ts#L9) | Implemented via `auth.passwordReset`. |

### POST `/auth/signup`

### Request Body

```json
{
	"name": "Dr. Smith",
	"email": "teacher@gmail.com",
	"password": "123456",
	"role": "teacher"
}
```

### Response

```json
{}
```

### POST `/auth/login`

### Request Body

```json
{
	"email": "teacher@gmail.com",
	"password": "123456"
}
```

### Response

```json
{}
```

### POST `/auth/refresh`

### Request Body

```json
{
	"refresh_token": "jwt"
}
```

### Response

```json
{}
```

### POST `/auth/password/forgot`

### Request Body

```json
{
	"email": "teacher@gmail.com"
}
```

### Response

```json
{}
```

### POST `/auth/password/reset`

### Request Body

```json
{
	"token": "reset_token",
	"new_password": "123456"
}
```

### Response

```json
{}
```

## USER MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| GET `/users/me` | Present | [backend/src/routes/userRoute.ts](backend/src/routes/userRoute.ts#L8) | Requires access token. |
| PATCH `/users/me` | Present | [backend/src/routes/userRoute.ts](backend/src/routes/userRoute.ts#L9) | Requires access token. |
| GET `/users` | Present | [backend/src/routes/userRoute.ts](backend/src/routes/userRoute.ts#L10) | Admin-only guard. |
| PATCH `/users/:userId` | Present | [backend/src/routes/userRoute.ts](backend/src/routes/userRoute.ts#L11) | Admin-only guard. |

### GET `/users/me`

### Request Body

```json
{}
```

### Response

```json
{}
```

### PATCH `/users/me`

### Request Body

```json
{
	"name": "Updated Name",
	"profile_image": "url"
}
```

### Response

```json
{}
```

### GET `/users`

### Request Body

```json
{}
```

### Response

```json
{}
```

### PATCH `/users/:userId`

### Request Body

```json
{}
```

### Response

```json
{}
```

## ASSIGNMENT MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/assignments` | Missing | - | Not found in backend or agent. |
| GET `/assignments/:assignmentId` | Missing | - | Not found in backend or agent. |
| GET `/teachers/:teacherId/assignments` | Missing | - | Not found in backend or agent. |
| PATCH `/assignments/:assignmentId` | Missing | - | Not found in backend or agent. |
| DELETE `/assignments/:assignmentId` | Missing | - | Not found in backend or agent. |

### POST `/assignments`

### Request Body

```json
{
	"title": "Midterm Exam",
	"subject": "Computer Science",
	"class_name": "CSE220",
	"topic": "Recursion",
	"teacher_id": "teacher_uuid",
	"total_marks": 50,
	"due_date": "2026-06-01"
}
```

### Response

```json
{
	"assignment_id": 12,
	"message": "Assignment created successfully"
}
```

### GET `/assignments/:assignmentId`

### Request Body

```json
{}
```

### Response

```json
{
	"assignment_id": 12,
	"title": "Midterm Exam",
	"subject": "Computer Science",
	"topic": "Recursion",
	"total_marks": 50
}
```

### GET `/teachers/:teacherId/assignments`

### Request Body

```json
{}
```

### Response

```json
{}
```

### PATCH `/assignments/:assignmentId`

### Request Body

```json
{
	"title": "Updated Midterm",
	"topic": "Dynamic Programming"
}
```

### Response

```json
{}
```

### DELETE `/assignments/:assignmentId`

### Request Body

```json
{}
```

### Response

```json
{}
```

## QUESTION MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/assignments/:assignmentId/questions/upload` | Partial | [agent/main.py](agent/main.py#L203) | Closest is POST `/question` with `file`, `is_handwritten`, `is_rubric`, `teacher_id`, `assignment_id`. Does not match requested path or include `assignmentId` param. |
| GET `/assignments/:assignmentId/questions` | Partial | [agent/main.py](agent/main.py#L70) | Existing GET `/api/questions` uses fixed `teacher_id` and `assignment_id` in SQL. |
| PATCH `/questions/:questionId` | Missing | - | Not found in backend or agent. |

### POST `/assignments/:assignmentId/questions/upload`

### multipart/form-data

| Field | Type | Required |
| ----- | ---- | -------- |
| file | UploadFile | Yes |
| teacher_id | string | Yes |
| is_handwritten | boolean | Yes |

### Response

```json
{
	"message": "Questions extracted successfully",
	"questions": [
		{
			"question_id": 1,
			"question_text": "Explain recursion",
			"marks": 5
		}
	]
}
```

### GET `/assignments/:assignmentId/questions`

### Request Body

```json
{}
```

### Response

```json
[
	{
		"question_id": 1,
		"question_text": "Explain recursion",
		"marks": 5,
		"concepts": [
			"recursion",
			"functions"
		]
	}
]
```

### PATCH `/questions/:questionId`

### Request Body

```json
{
	"question_text": "Updated question text",
	"marks": 10
}
```

### Response

```json
{}
```

## RUBRIC MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/assignments/:assignmentId/rubrics/upload` | Partial | [agent/main.py](agent/main.py#L203) | Same POST `/question` endpoint handles rubric with `is_rubric`. Path differs. |
| GET `/assignments/:assignmentId/rubrics` | Partial | [agent/main.py](agent/main.py#L98) | Existing GET `/api/rubrics` uses fixed `teacher_id` and `assignment_id` in SQL. |
| PATCH `/rubrics/:rubricId` | Missing | - | Not found in backend or agent. |

### POST `/assignments/:assignmentId/rubrics/upload`

### multipart/form-data

| Field | Type | Required |
| ----- | ---- | -------- |
| file | UploadFile | Yes |
| teacher_id | string | Yes |

### Response

```json
{
	"message": "Rubric extracted successfully",
	"rubrics": [
		{
			"criterion": "Definition",
			"marks": 1
		},
		{
			"criterion": "Base Case",
			"marks": 1
		}
	]
}
```

### GET `/assignments/:assignmentId/rubrics`

### Request Body

```json
{}
```

### Response

```json
[
	{
		"rubric_id": 1,
		"question_id": 1,
		"criteria": [
			{
				"criterion": "Definition",
				"marks": 1
			}
		]
	}
]
```

### PATCH `/rubrics/:rubricId`

### Request Body

```json
{
	"criteria": [
		{
			"criterion": "Definition",
			"marks": 2
		}
	]
}
```

### Response

```json
{}
```

## TEACHER SOLUTION MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/assignments/:assignmentId/solutions/upload` | Partial | [agent/main.py](agent/main.py#L203) | Same POST `/question` endpoint handles `teacher_solve` when `is_rubric=false`. Path differs and does not include `question_id`. |
| GET `/assignments/:assignmentId/solutions` | Missing | - | Not found in backend or agent. |

### POST `/assignments/:assignmentId/solutions/upload`

### multipart/form-data

| Field | Type | Required |
| ----- | ---- | -------- |
| file | UploadFile | Yes |
| teacher_id | string | Yes |
| question_id | integer | Yes |

### Response

```json
{
	"message": "Teacher solution uploaded successfully"
}
```

### GET `/assignments/:assignmentId/solutions`

### Request Body

```json
{}
```

### Response

```json
[
	{
		"question_id": 1,
		"solution_text": "Recursion is a function calling itself..."
	}
]
```

## KNOWLEDGE / RAG MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/knowledge/upload` | Missing | - | Not found in backend or agent. |
| POST `/knowledge/index` | Missing | - | Not found in backend or agent. |
| POST `/knowledge/retrieve` | Missing | - | Not found in backend or agent. |

### POST `/knowledge/upload`

### multipart/form-data

| Field | Type | Required |
| ----- | ---- | -------- |
| file | UploadFile | Yes |
| teacher_id | string | Yes |
| subject | string | Yes |
| topic | string | Yes |
| type | string | Yes |

### Allowed Types

```text
lecture_note
curriculum
grading_example
reference_solution
teacher_note
model_answer
```

### Response

```json
{
	"document_id": 44,
	"message": "Knowledge document uploaded"
}
```

### POST `/knowledge/index`

### Request Body

```json
{
	"document_id": 44
}
```

### Response

```json
{
	"message": "Document indexed successfully"
}
```

### POST `/knowledge/retrieve`

### Request Body

```json
{
	"query": "Recursion base case explanation",
	"top_k": 5
}
```

### Response

```json
{
	"chunks": [
		{
			"text": "A recursive function must contain a base case...",
			"score": 0.91
		}
	]
}
```

## ANSWER MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/answers/upload` | Partial | [agent/main.py](agent/main.py#L125) | Existing POST `/answer` handles file + teacher_id + student_id + assignment_id. Path differs. |
| GET `/assignments/:assignmentId/students/:studentId/answers` | Missing | - | Not found in backend or agent. |
| GET `/answers/:answerId/extracted` | Missing | - | Not found in backend or agent. |

### POST `/answers/upload`

### multipart/form-data

| Field | Type | Required |
| ----- | ---- | -------- |
| file | UploadFile | Yes |
| teacher_id | string | Yes |
| student_id | string | Yes |
| assignment_id | integer | Yes |

### Response

```json
{
	"message": "Answer uploaded successfully",
	"answer_id": 22
}
```

### GET `/assignments/:assignmentId/students/:studentId/answers`

### Request Body

```json
{}
```

### Response

```json
{
	"student_id": "student_uuid",
	"answers": [
		{
			"question_id": 1,
			"answer_text": "Recursion is..."
		}
	]
}
```

### GET `/answers/:answerId/extracted`

### Request Body

```json
{}
```

### Response

```json
{
	"answer_id": 22,
	"extracted_text": "Recursion is..."
}
```

## GRADING MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/grading/start` | Partial | [agent/main.py](agent/main.py#L276) | Existing POST `/api/grade` uses teacher_id, student_id, assignment_id. Path differs. |
| GET `/grading/jobs/:jobId` | Missing | - | Not found in backend or agent. |
| GET `/grading/results/:assignmentId/:studentId` | Missing | - | Not found in backend or agent. |
| PATCH `/grading/results/:resultId/review` | Missing | - | Not found in backend or agent. |

### POST `/grading/start`

### Request Body

```json
{
	"teacher_id": "teacher_uuid",
	"assignment_id": 12,
	"student_id": "student_uuid"
}
```

### Response

```json
{
	"job_id": "grading_job_uuid",
	"status": "queued"
}
```

### GET `/grading/jobs/:jobId`

### Request Body

```json
{}
```

### Response

```json
{
	"job_id": "grading_job_uuid",
	"status": "running"
}
```

### GET `/grading/results/:assignmentId/:studentId`

### Request Body

```json
{}
```

### Response

```json
{
	"total_score": 42,
	"max_score": 50,
	"questions": [
		{
			"question_id": 1,
			"score": 4,
			"max_score": 5,
			"feedback": "Missing base case explanation",
			"rubric_breakdown": [
				{
					"criterion": "Definition",
					"score": 1
				},
				{
					"criterion": "Base Case",
					"score": 0
				}
			]
		}
	]
}
```

### PATCH `/grading/results/:resultId/review`

### Request Body

```json
{
	"teacher_score": 5,
	"teacher_feedback": "Accepted alternate explanation",
	"approved": true
}
```

### Response

```json
{
	"message": "Review updated successfully"
}
```

## GRAPH RAG MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/concepts/graph` | Missing | - | Not found in backend or agent. |
| GET `/concepts/:conceptId/dependencies` | Missing | - | Not found in backend or agent. |
| POST `/concepts/map-errors` | Missing | - | Not found in backend or agent. |
| GET `/students/:studentId/learning-path` | Missing | - | Not found in backend or agent. |

### POST `/concepts/graph`

### Request Body

```json
{
	"subject": "Computer Science",
	"concepts": [
		{
			"name": "Recursion",
			"prerequisites": [
				"Functions"
			]
		}
	]
}
```

### Response

```json
{}
```

### GET `/concepts/:conceptId/dependencies`

### Request Body

```json
{}
```

### Response

```json
{
	"concept": "Recursion",
	"dependencies": [
		"Functions"
	]
}
```

### POST `/concepts/map-errors`

### Request Body

```json
{
	"grading_result_id": 1
}
```

### Response

```json
{}
```

### GET `/students/:studentId/learning-path`

### Request Body

```json
{}
```

### Response

```json
{
	"weak_concepts": [
		"Functions",
		"Recursion"
	],
	"recommended_order": [
		"Functions",
		"Recursion",
		"Dynamic Programming"
	]
}
```

## REMEDIATION MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| POST `/remediation/generate` | Missing | - | Not found in backend or agent. |
| GET `/students/:studentId/feedback` | Missing | - | Not found in backend or agent. |
| GET `/students/:studentId/weak-concepts` | Missing | - | Not found in backend or agent. |

### POST `/remediation/generate`

### Request Body

```json
{
	"student_id": "student_uuid",
	"assignment_id": 12
}
```

### Response

```json
{
	"practice_questions": [
		{
			"topic": "Recursion",
			"question": "Write factorial using recursion"
		}
	]
}
```

### GET `/students/:studentId/feedback`

### Request Body

```json
{}
```

### Response

```json
{
	"feedback": [
		{
			"concept": "Recursion",
			"comment": "Need stronger understanding of base cases"
		}
	]
}
```

### GET `/students/:studentId/weak-concepts`

### Request Body

```json
{}
```

### Response

```json
{
	"weak_concepts": [
		"Functions",
		"Recursion"
	]
}
```

## ANALYTICS MODULE

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| GET `/analytics/assignments/:assignmentId` | Missing | - | Not found in backend or agent. |
| GET `/analytics/assignments/:assignmentId/mistakes` | Missing | - | Not found in backend or agent. |
| GET `/analytics/students/:studentId/progress` | Missing | - | Not found in backend or agent. |

### GET `/analytics/assignments/:assignmentId`

### Request Body

```json
{}
```

### Response

```json
{
	"average_score": 72,
	"weak_topics": [
		"Recursion",
		"Pointers"
	]
}
```

### GET `/analytics/assignments/:assignmentId/mistakes`

### Request Body

```json
{}
```

### Response

```json
{
	"common_mistakes": [
		{
			"concept": "Recursion",
			"count": 24
		}
	]
}
```

### GET `/analytics/students/:studentId/progress`

### Request Body

```json
{}
```

### Response

```json
{
	"student_id": "student_uuid",
	"progress": [
		{
			"topic": "Recursion",
			"score": 80
		}
	]
}
```

## OTHER EXISTING ENDPOINTS (NOT IN BLUEPRINT)

| Endpoint | Status | Implementation | Notes |
| --- | --- | --- | --- |
| GET `/health` | Present | [backend/src/routes/healthRoute.ts](backend/src/routes/healthRoute.ts#L6) | Health check. |
| GET `/api/seed-data` | Present | [agent/main.py](agent/main.py#L30) | Returns fixed teacher/student/assignment data. |

### GET `/health`

### Request Body

```json
{}
```

### Response

```json
{}
```

### GET `/api/seed-data`

### Request Body

```json
{}
```

### Response

```json
{}
```
