import { Router } from 'express';
import { 
  createAssignment, 
  getAssignments,
  searchAssignmentsByTitle,
  getAssignmentById, 
  updateAssignment
  ,deleteAssignment
} from '../controllers/assignmentController.js'; // Adjust the import path as needed
import { requireAccessToken } from '../common/middleware/jwt.middleware.js';

export const assignmentRouter = Router();

assignmentRouter.use(requireAccessToken);

// POST /assignments
assignmentRouter.post('/', createAssignment);

// GET /assignments
assignmentRouter.get('/', getAssignments);

// GET /assignments/search?title=...
assignmentRouter.get('/search', searchAssignmentsByTitle);

// GET /assignments/:assignmentId
assignmentRouter.get('/:assignmentId', getAssignmentById);

// PATCH /assignments/:assignmentId
assignmentRouter.patch('/:assignmentId', updateAssignment);

assignmentRouter.delete('/:assignmentId',deleteAssignment)
