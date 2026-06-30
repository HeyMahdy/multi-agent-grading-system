import { Request, Response } from 'express';
import { pool } from '../lib/database.js';

/**
 * Add a new student for a teacher
 */
export const addStudent = async (req: Request, res: Response) => {
  try {
    const { id, student_id, name } = req.body;
    const studentId = student_id ?? id;
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    if (!studentId || !name) {
      return res.status(400).json({ error: 'Student ID and name are required' });
    }

    // Insert new student
    const query = `
      INSERT INTO public.students (teacher_id, student_id, name)
      VALUES ($1, $2, $3)
      RETURNING teacher_id, id, student_id, name, created_at;
    `;

    const result = await pool.query(query, [teacherId, studentId, name]);

    return res.status(201).json({
      message: 'Student added successfully',
      data: result.rows[0]
    });

  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Student with this ID already exists for this teacher',
        details: error.message 
      });
    }
    
    console.error('Error adding student:', error.message);
    return res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
};

/**
 * Get all students for a teacher
 */
export const getStudentsByTeacher = async (req: Request, res: Response) => {
  try {
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    // Query to fetch all students for this teacher
    const query = `
      SELECT teacher_id, id, student_id, name, created_at 
      FROM public.students 
      WHERE teacher_id = $1
      ORDER BY name ASC;
    `;

    const result = await pool.query(query, [teacherId]);

    return res.status(200).json({
      message: 'Students retrieved successfully',
      count: result.rowCount ?? (result.rows ? result.rows.length : 0),
      data: result.rows
    });

  } catch (error: any) {
    console.error('Error fetching students:', error.message);
    return res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
};

/**
 * Search students by student ID and/or name for a teacher
 */
export const searchStudents = async (req: Request, res: Response) => {
  try {
    const teacherId = req.authUser?.id;
    const studentId = typeof req.query['student_id'] === 'string' ? req.query['student_id'].trim() : '';
    const name = typeof req.query['name'] === 'string' ? req.query['name'].trim() : '';

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    if (!studentId && !name) {
      return res.status(400).json({ error: 'student_id or name query parameter is required' });
    }

    const filters: string[] = ['teacher_id = $1'];
    const queryValues: any[] = [teacherId];
    let paramIndex = 2;

    if (studentId) {
      filters.push(`student_id ILIKE $${paramIndex++}`);
      queryValues.push(`%${studentId}%`);
    }

    if (name) {
      filters.push(`name ILIKE $${paramIndex++}`);
      queryValues.push(`%${name}%`);
    }

    const query = `
      SELECT teacher_id, id, student_id, name, created_at 
      FROM public.students 
      WHERE ${filters.join(' AND ')}
      ORDER BY name ASC;
    `;

    const result = await pool.query(query, queryValues);

    return res.status(200).json({
      message: 'Students retrieved successfully',
      count: result.rowCount ?? result.rows.length,
      data: result.rows
    });

  } catch (error: any) {
    console.error('Error searching students:', error.message);
    return res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
};

/**
 * Get a specific student by ID
 */
export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    // Query to fetch specific student
    const query = `
      SELECT teacher_id, id, student_id, name, created_at 
      FROM public.students 
      WHERE teacher_id = $1 AND id = $2;
    `;

    const result = await pool.query(query, [teacherId, studentId]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Student not found or you are not authorized to view it' 
      });
    }

    return res.status(200).json({
      message: 'Student retrieved successfully',
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error fetching student:', error.message);
    return res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
};

/**
 * Get all assignments for a student with total marks obtained
 */
export const getStudentAssignmentsWithMarks = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    const studentQuery = `
      SELECT teacher_id, id, student_id, name, created_at
      FROM public.students
      WHERE teacher_id = $1 AND student_id = $2;
    `;

    const studentResult = await pool.query(studentQuery, [teacherId, studentId]);

    if (!studentResult.rows || studentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Student not found or you are not authorized to view it'
      });
    }

    const assignmentsQuery = `
      SELECT
        assignments.id as assignment_id,
        assignments.title,
        assignments.subject,
        assignments.total_marks as assignment_total_marks,
        COALESCE(score_totals.marks_obtained, 0)::float as marks_obtained,
        COALESCE(score_totals.graded_question_count, 0)::int as graded_question_count,
        assignments.created_at
      FROM public.assignments
      LEFT JOIN (
        SELECT
          assignment_id,
          SUM(marks)::float as marks_obtained,
          COUNT(*)::int as graded_question_count
        FROM public.student_question_scores
        WHERE teacher_id = $1 AND student_id = $2
        GROUP BY assignment_id
      ) score_totals ON score_totals.assignment_id = assignments.id
      WHERE assignments.teacher_id = $1
      ORDER BY assignments.created_at DESC;
    `;

    const assignmentsResult = await pool.query(assignmentsQuery, [teacherId, studentId]);

    return res.status(200).json({
      message: 'Student assignment marks retrieved successfully',
      student: studentResult.rows[0],
      data: assignmentsResult.rows
    });

  } catch (error: any) {
    console.error('Error fetching student assignment marks:', error.message);
    return res.status(500).json({
      error: 'Database error',
      details: error.message
    });
  }
};

/**
 * Get only graded assignments for a student with total marks obtained
 */
export const getStudentAssignmentGrades = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    const studentQuery = `
      SELECT teacher_id, id, student_id, name, created_at
      FROM public.students
      WHERE teacher_id = $1 AND id = $2;
    `;

    const studentResult = await pool.query(studentQuery, [teacherId, studentId]);

    if (!studentResult.rows || studentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Student not found or you are not authorized to view it'
      });
    }

    const studentUuid = studentResult.rows[0].id;

    const gradesQuery = `
      SELECT
        assignments.id as assignment_id,
        assignments.title,
        assignments.subject,
        assignments.total_marks as assignment_total_marks,
        score_totals.marks_obtained::float as marks_obtained,
        score_totals.graded_question_count::int as graded_question_count,
        assignments.created_at
      FROM (
        SELECT
          assignment_id,
          SUM(marks)::float as marks_obtained,
          COUNT(*)::int as graded_question_count
        FROM public.student_question_scores
        WHERE teacher_id = $1 AND student_id = $2
        GROUP BY assignment_id
      ) score_totals
      INNER JOIN public.assignments
        ON assignments.id = score_totals.assignment_id
        AND assignments.teacher_id = $1
      ORDER BY assignments.created_at DESC;
    `;

    const gradesResult = await pool.query(gradesQuery, [teacherId, studentUuid]);

    return res.status(200).json({
      message: 'Student assignment grades retrieved successfully',
      student: studentResult.rows[0],
      count: gradesResult.rowCount ?? gradesResult.rows.length,
      data: gradesResult.rows
    });

  } catch (error: any) {
    console.error('Error fetching student assignment grades:', error.message);
    return res.status(500).json({
      error: 'Database error',
      details: error.message
    });
  }
};

/**
 * Update a student's information
 */
export const updateStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const { name, student_id } = req.body;
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    const setFields: string[] = [];
    const queryValues: any[] = [];
    let paramIndex = 1;

    if (name !== undefined && name !== null && String(name).trim() !== '') {
      setFields.push('name = $' + paramIndex++);
      queryValues.push(name);
    }

    if (student_id !== undefined && student_id !== null && String(student_id).trim() !== '') {
      setFields.push('student_id = $' + paramIndex++);
      queryValues.push(student_id);
    }

    if (setFields.length === 0) {
      const existingQuery = `
        SELECT teacher_id, id, student_id, name, created_at 
        FROM public.students 
        WHERE teacher_id = $1 AND id = $2;
      `;
      const fallbackResult = await pool.query(existingQuery, [teacherId, studentId]);
      
      if (!fallbackResult.rows || fallbackResult.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      return res.status(200).json({
        message: 'No modifications requested. Student remained unchanged.',
        data: fallbackResult.rows[0]
      });
    }

    queryValues.push(teacherId);
    const teacherIdParam = '$' + paramIndex++;

    queryValues.push(studentId);
    const studentUuidParam = '$' + paramIndex++;

    const query = `
      UPDATE public.students 
      SET ${setFields.join(', ')}
      WHERE teacher_id = ${teacherIdParam} AND id = ${studentUuidParam}
      RETURNING teacher_id, id, student_id, name, created_at;
    `;

    const result = await pool.query(query, queryValues);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Student not found or you are not authorized to modify it' 
      });
    }

    return res.status(200).json({
      message: 'Student updated successfully',
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error updating student:', error.message);
    return res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
};

/**
 * Delete a student
 */
export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.authUser?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    }

    // Delete student
    const query = `
      DELETE FROM public.students 
      WHERE teacher_id = $1 AND id = $2
      RETURNING teacher_id, id, student_id, name;
    `;

    const result = await pool.query(query, [teacherId, studentId]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Student not found or you are not authorized to delete it' 
      });
    }

    return res.status(200).json({
      message: 'Student deleted successfully',
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error deleting student:', error.message);
    return res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
};
