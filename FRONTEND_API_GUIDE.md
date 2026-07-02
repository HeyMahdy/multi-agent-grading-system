# Frontend API Integration Guide

## Base URL: `http://localhost:8080`

## Authentication
All protected endpoints require: `Authorization: Bearer <access_token>`

---

## Auth

### POST `/auth/signup`
**Request:** `{ "email": "teacher@example.com", "password": "min8chars", "display_name": "Dr. Smith" }`
**Response (201):** `{ "access_token": "jwt...", "token_type": "Bearer", "user": { "id": "uuid", "email": "...", "display_name": "..." } }`

### POST `/auth/login`
**Request:** `{ "email": "teacher@example.com", "password": "min8chars" }`
**Response (200):** `{ "access_token": "jwt...", "token_type": "Bearer", "user": { "id": "uuid", "email": "...", "display_name": "..." } }`

---

## User Profile

### GET `/users/me`
**Response (200):** `{ "id": "uuid", "email": "...", "display_name": "...", "created_at": "..." }`

### PATCH `/users/me`
**Request:** `{ "display_name": "New Name" }`
**Response (200):** Same as GET

---

## Students

### POST `/students`
**Request:** `{ "id": "2021001", "name": "Alice Johnson" }`
**Response (201):** `{ "message": "Student added successfully", "data": { "teacher_id": "uuid", "id": "2021001", "name": "Alice Johnson", "created_at": "..." } }`

### GET `/students`
**Response (200):** `{ "message": "Students retrieved successfully", "count": 25, "data": [{ "teacher_id": "uuid", "id": "2021001", "name": "Alice", "created_at": "..." }] }`

### GET `/students/:studentId`
**Response (200):** `{ "message": "Student retrieved successfully", "data": { ... } }`

### PATCH `/students/:studentId`
**Request:** `{ "name": "Updated Name" }`
**Response (200):** `{ "message": "Student updated successfully", "data": { ... } }`

### DELETE `/students/:studentId`
**Response (200):** `{ "message": "Student deleted successfully", "data": { "teacher_id": "uuid", "id": "2021001", "name": "Alice" } }`

---

## Assignments

### POST `/assignments`
**Request:** `{ "title": "Midterm Exam", "subject": "Computer Science", "total_marks": 50 }`
**Response (201):** `{ "assignment_id": 12, "message": "Assignment created successfully" }`

### GET `/assignments/:assignmentId`
**Response (200):** `{ "assignment_id": 12, "title": "...", "subject": "...", "total_marks": 50, "created_at": "..." }`

### PATCH `/assignments/:assignmentId`
**Request:** `{ "title": "Updated", "subject": "Physics", "total_marks": 60 }` (all optional)
**Response (200):** Full updated assignment object

### DELETE `/assignments/:assignmentId`
**Response (200):** `{ "message": "Assignment deleted successfully" }`

---

## Questions (AI OCR Upload)

### POST `/assignments/:assignmentId/questions/upload`
**Content-Type:** multipart/form-data
**Fields:** `files` (up to 10), `is_handwritten` ("true"/"false")
**Response (200):** `{ "message": "Questions processed successfully", "data": "<JSON string of extracted questions>" }`

### GET `/assignments/:assignmentId/questions`
**Response (200):** `{ "message": "Questions retrieved successfully", "count": 5, "data": [{ "id": 1, "question_label": "1a", "question_description": "...", "marks": 5, "created_at": "..." }] }`

### PATCH `/assignments/:questionId/questions`
**Request:** `{ "question_label": "1a", "question_description": "...", "marks": 7 }` (all optional)
**Response (200):** `{ "message": "Question updated successfully", "data": { ... } }`

---

## Rubrics (AI OCR Upload + Manual Create)

### POST `/assignments/:assignmentId/rubrics/upload`
**Content-Type:** multipart/form-data
**Fields:** `files` (up to 10), `is_handwritten` ("true"/"false")
**Response (200):** `{ "message": "Rubrics processed successfully", "data": "<JSON string>" }`

### POST `/assignments/:assignmentId/rubrics`
**Manual create — Request:**
```json
{
  "question_label": "1a",
  "rubric_description": {
    "criteria": [{ "points": 2.0, "description": "Correct setup" }],
    "penalties": [{ "deduction": 1.0, "condition": "Missing steps" }],
    "fatal_flaw": "Completely wrong approach"
  }
}
```
**Response (201):** `{ "message": "Rubric created successfully", "data": { "id": 5, "question_label": "1a", "rubric_description": {...}, "created_at": "..." } }`

### GET `/assignments/:assignmentId/rubrics`
**Response (200):** `{ "message": "Rubrics retrieved successfully", "count": 5, "data": [{ "id": 1, "question_label": "1a", "rubric_description": {...}, "created_at": "..." }] }`

### PATCH `/assignments/:rubricId/rubrics`
**Request:** `{ "question_label": "1a", "rubric_description": {...} }` (all optional)
**Response (200):** `{ "message": "Rubric updated successfully", "data": { ... } }`

### DELETE `/assignments/:assignmentId/rubrics/:rubricId`
**Response (200):** `{ "message": "Rubric deleted successfully", "data": { "id": 5, "question_label": "1a" } }`

---

## Teacher Solutions (AI OCR Upload)

### POST `/assignments/:assignmentId/solutions/upload`
**Content-Type:** multipart/form-data
**Fields:** `files` (up to 10), `is_handwritten` ("true"/"false")
**Response (200):** `{ "message": "Solutions processed successfully", "data": "<JSON string>" }`

### GET `/assignments/:assignmentId/solutions`
**Response (200):** `{ "message": "Solutions retrieved successfully", "count": 3, "data": [{ "id": 1, "question_label": "1a", "solution_text": "...", "created_at": "..." }] }`

### PATCH `/assignments/:solutionId/solutions`
**Request:** `{ "question_label": "1a", "solution_text": "..." }` (all optional)
**Response (200):** `{ "message": "Solution updated successfully", "data": { ... } }`

### DELETE `/assignments/:assignmentId/solutions/:solutionId`
**Response (200):** `{ "message": "Solution deleted successfully", "data": { "id": 1, "question_label": "1a" } }`

---

## Student Answers (AI OCR Upload)

### POST `/assignments/:assignmentId/students/:studentId/answers/upload`
**Content-Type:** multipart/form-data
**Fields:** `files` (up to 10), `is_handwritten` ("true"/"false")
**Response (200):** `{ "message": "Student answers processed successfully", "data": "<JSON string>" }`

### GET `/assignments/:assignmentId/students/:studentId/answers`
**Response (200):** `{ "message": "Student answers retrieved successfully", "count": 5, "data": [{ "id": 1, "question_label": "1a", "answer": "...", "created_at": "..." }] }`

### PATCH `/student-answers/:answerId`
**Request:** `{ "question_label": "1a", "answer": "..." }` (all optional)
**Response (200):** `{ "message": "Student answer updated successfully", "data": { ... } }`

---

## Grading (AI Dual-Grader)

### POST `/assignments/:assignmentId/students/:studentId/grade`
Triggers AI grading. Compares student answers against rubrics + teacher solutions using two AI graders.
**Response (200):**
```json
{
  "message": "Grading completed successfully",
  "data": [
    {
      "label": "1a",
      "grader_1_score": 4.0,
      "grader_2_score": 4.5,
      "final_score": 4.25,
      "confidence": 0.89,
      "confidence_label": "high"
    }
  ]
}
```

### GET `/assignments/:assignmentId/students/:studentId/scores`
**Response (200):**
```json
{
  "message": "Grading results retrieved successfully",
  "count": 5,
  "total_marks": 42.5,
  "data": [
    {
      "id": 1,
      "question_label": "1a",
      "student_solution": "...",
      "marks": 4.25,
      "confidence_score": 0.89,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

## Syllabus GraphRAG

### POST `/syllabus/upload`
**Content-Type:** multipart/form-data
**Fields:** `file` (single PDF/DOCX/TXT)
**Response (200):**
```json
{
  "message": "Syllabus processed successfully",
  "data": {
    "syllabus_id": 1,
    "status": "completed",
    "entity_count": 22,
    "relationship_count": 18
  }
}
```

### GET `/syllabus/:syllabusId/graph`
**Response (200):**
```json
{
  "message": "Graph retrieved successfully",
  "data": {
    "nodes": [
      { "id": 1, "name": "Recursion", "entity_type": "topic", "description": "...", "difficulty_level": "intermediate", "week_or_unit": "Week 5" }
    ],
    "edges": [
      { "id": 1, "source": "Functions", "target": "Recursion", "relationship_type": "PREREQUISITE_OF", "strength": 5, "reason": "..." }
    ]
  }
}
```

### POST `/syllabus/query`
**Request:** `{ "query": "What do I need to learn before Dynamic Programming?", "syllabus_id": 1 }`
**Response (200):**
```json
{
  "message": "Query completed",
  "data": {
    "answer": "Before learning Dynamic Programming, you need to understand Recursion and Divide & Conquer...",
    "matched_entities": [{ "name": "Dynamic Programming", "type": "topic", "similarity": 0.92 }],
    "prerequisites": ["Recursion", "Functions", "Arrays"],
    "related_topics": ["Greedy Algorithms", "Memoization"]
  }
}
```

### GET `/syllabus/:syllabusId/prerequisites/:topic`
**Response (200):**
```json
{
  "message": "Prerequisites retrieved",
  "data": {
    "topic": "Dynamic Programming",
    "prerequisite_chain": [
      { "name": "Programming Basics", "entity_type": "topic", "difficulty_level": "beginner", "depth": 3 },
      { "name": "Functions", "entity_type": "topic", "difficulty_level": "beginner", "depth": 2 },
      { "name": "Recursion", "entity_type": "topic", "difficulty_level": "intermediate", "depth": 1 },
      { "name": "Dynamic Programming", "entity_type": "topic", "difficulty_level": "advanced", "depth": 0 }
    ]
  }
}
```

---

## Quick Reference

| Module | Endpoint | Method |
|--------|----------|--------|
| Auth | `/auth/signup` | POST |
| Auth | `/auth/login` | POST |
| User | `/users/me` | GET, PATCH |
| Students | `/students` | POST, GET |
| Students | `/students/:studentId` | GET, PATCH, DELETE |
| Assignments | `/assignments` | POST |
| Assignments | `/assignments/:assignmentId` | GET, PATCH, DELETE |
| Questions | `/assignments/:assignmentId/questions/upload` | POST |
| Questions | `/assignments/:assignmentId/questions` | GET |
| Questions | `/assignments/:questionId/questions` | PATCH |
| Rubrics | `/assignments/:assignmentId/rubrics/upload` | POST |
| Rubrics | `/assignments/:assignmentId/rubrics` | POST, GET |
| Rubrics | `/assignments/:rubricId/rubrics` | PATCH |
| Rubrics | `/assignments/:assignmentId/rubrics/:rubricId` | DELETE |
| Solutions | `/assignments/:assignmentId/solutions/upload` | POST |
| Solutions | `/assignments/:assignmentId/solutions` | GET |
| Solutions | `/assignments/:solutionId/solutions` | PATCH |
| Solutions | `/assignments/:assignmentId/solutions/:solutionId` | DELETE |
| Student Answers | `/assignments/:assignmentId/students/:studentId/answers/upload` | POST |
| Student Answers | `/assignments/:assignmentId/students/:studentId/answers` | GET |
| Student Answers | `/student-answers/:answerId` | PATCH |
| Grading | `/assignments/:assignmentId/students/:studentId/grade` | POST |
| Grading | `/assignments/:assignmentId/students/:studentId/scores` | GET |
| Syllabus | `/syllabus/upload` | POST |
| Syllabus | `/syllabus/:syllabusId/graph` | GET |
| Syllabus | `/syllabus/query` | POST |
| Syllabus | `/syllabus/:syllabusId/prerequisites/:topic` | GET |

---

## File Upload Pattern (for all upload endpoints)

```javascript
const formData = new FormData();
formData.append('files', file1);  // or 'file' for syllabus (single)
formData.append('is_handwritten', 'false');

const response = await fetch('http://localhost:8080/assignments/4/questions/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

## Error Format
```json
{ "error": "Error message", "details": "Additional info" }
```

## Status Codes
- 200: Success
- 201: Created
- 400: Bad request / validation error
- 401: Unauthorized (missing/invalid token)
- 404: Not found
- 409: Conflict (duplicate)
- 500: Server error
