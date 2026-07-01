import { Router } from 'express';
import { requireAccessToken } from '../common/middleware/jwt.middleware.js';
import {
  getTAAssignmentMistakes,
  getTAAssignmentOverview,
  getTAStudentAssignmentPerformance,
  getTAStudentOverview,
  getTAStudentWeakConcepts,
  resolveTAContext,
} from '../controllers/taContextController.js';

export const taContextRouter = Router();

taContextRouter.use(requireAccessToken);

taContextRouter.post('/ta/context/resolve', resolveTAContext);
taContextRouter.get('/ta/context/students/:studentRef/overview', getTAStudentOverview);
taContextRouter.get('/ta/context/assignments/:assignmentId/overview', getTAAssignmentOverview);
taContextRouter.get(
  '/ta/context/students/:studentRef/assignments/:assignmentId/performance',
  getTAStudentAssignmentPerformance,
);
taContextRouter.get('/ta/context/assignments/:assignmentId/mistakes', getTAAssignmentMistakes);
taContextRouter.get('/ta/context/students/:studentRef/weak-concepts', getTAStudentWeakConcepts);
