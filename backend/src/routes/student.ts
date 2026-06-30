import { Router } from 'express';
import { 
  addStudent, 
  getStudentsByTeacher, 
  searchStudents,
  getStudentById, 
  getStudentAssignmentsWithMarks,
  getStudentAssignmentGrades,
  updateStudent, 
  deleteStudent 
} from '../controllers/studentController.js';
import { requireAccessToken } from '../common/middleware/jwt.middleware.js';

export const studentRouter = Router();

// Secure all student routes with global access token verification middleware
studentRouter.use(requireAccessToken);

// Add a new student
studentRouter.post('/students', addStudent);

// Get all students for the authenticated teacher
studentRouter.get('/students', getStudentsByTeacher);

// Search students by student ID and/or name
studentRouter.get('/students/search', searchStudents);

// Get all assignments and marks for a specific student
studentRouter.get('/students/:studentId/assignments', getStudentAssignmentsWithMarks);

// Get only graded assignments for a specific student
studentRouter.get('/students/:studentId/assignment-grades', getStudentAssignmentGrades);

// Get a specific student by ID
studentRouter.get('/students/:studentId', getStudentById);

// Update a student's information
studentRouter.patch('/students/:studentId', updateStudent);

// Delete a student
studentRouter.delete('/students/:studentId', deleteStudent);
