import { Request, Response } from 'express';
import { pool } from '../lib/database.js';

type EntityStatus = 'resolved' | 'multiple_matches' | 'not_found';

type StudentCandidate = {
  student_uuid: string;
  student_id: string;
  name: string;
  created_at: string | null;
  display: string;
};

type AssignmentCandidate = {
  assignment_id: number;
  title: string;
  subject: string | null;
  total_marks: number | null;
  created_at: string | null;
  display: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assignmentNoiseWords = new Set([
  'assignment',
  'assignments',
  'exam',
  'exams',
  'test',
  'tests',
  'quiz',
  'quizzes',
  'paper',
  'assessment',
  'assessments',
  'homework',
  'hw',
  'the',
]);

function requireTeacherId(req: Request, res: Response) {
  const teacherId = req.authUser?.id;
  if (!teacherId) {
    res.status(401).json({ error: 'Unauthorized: Missing teacher identity' });
    return null;
  }
  return teacherId;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function tokenizeAssignmentReference(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !assignmentNoiseWords.has(token))
    .slice(0, 8);
}

function assignmentTokenAlternatives(token: string) {
  if (token === 'midterm') return ['midterm', 'mid', 'term'];
  if (token === 'finals') return ['finals', 'final'];
  return [token];
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function studentDisplay(row: any) {
  return `${row.name} (${row.student_id})`;
}

function assignmentDisplay(row: any) {
  const subject = row.subject ? `, ${row.subject}` : '';
  return `${row.title}${subject}`;
}

function mapStudent(row: any): StudentCandidate {
  return {
    student_uuid: String(row.id),
    student_id: row.student_id,
    name: row.name,
    created_at: toIso(row.created_at),
    display: studentDisplay(row),
  };
}

function mapAssignment(row: any): AssignmentCandidate {
  return {
    assignment_id: Number(row.assignment_id ?? row.id),
    title: row.title,
    subject: row.subject ?? null,
    total_marks: row.total_marks === null || row.total_marks === undefined ? null : Number(row.total_marks),
    created_at: toIso(row.created_at),
    display: assignmentDisplay(row),
  };
}

async function getAssignmentSyllabus(assignmentId: number) {
  const result = await pool.query(
    `
      SELECT id as syllabus_id, status, filename, entity_count, relationship_count, created_at
      FROM public.syllabi
      WHERE assignment_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `,
    [assignmentId],
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    syllabus_id: row.syllabus_id,
    status: row.status,
    filename: row.filename,
    entity_count: row.entity_count,
    relationship_count: row.relationship_count,
    created_at: toIso(row.created_at),
  };
}

async function resolveStudentCandidates(teacherId: string, ref: string) {
  const trimmed = ref.trim();
  if (!trimmed) return [];

  if (uuidPattern.test(trimmed)) {
    const result = await pool.query(
      `
        SELECT id, student_id, name, created_at
        FROM public.students
        WHERE teacher_id = $1 AND id = $2
        LIMIT 1;
      `,
      [teacherId, trimmed],
    );
    return result.rows.map(mapStudent);
  }

  const exactIdResult = await pool.query(
    `
      SELECT id, student_id, name, created_at
      FROM public.students
      WHERE teacher_id = $1 AND student_id = $2
      ORDER BY name ASC
      LIMIT 5;
    `,
    [teacherId, trimmed],
  );
  if (exactIdResult.rows.length > 0) return exactIdResult.rows.map(mapStudent);

  const exactNameResult = await pool.query(
    `
      SELECT id, student_id, name, created_at
      FROM public.students
      WHERE teacher_id = $1 AND LOWER(name) = LOWER($2)
      ORDER BY name ASC, student_id ASC
      LIMIT 5;
    `,
    [teacherId, trimmed],
  );
  if (exactNameResult.rows.length > 0) return exactNameResult.rows.map(mapStudent);

  const partialResult = await pool.query(
    `
      SELECT id, student_id, name, created_at
      FROM public.students
      WHERE teacher_id = $1
        AND (name ILIKE $2 OR student_id ILIKE $2)
      ORDER BY
        CASE WHEN name ILIKE $3 OR student_id ILIKE $3 THEN 0 ELSE 1 END,
        name ASC,
        student_id ASC
      LIMIT 5;
    `,
    [teacherId, `%${trimmed}%`, `${trimmed}%`],
  );
  return partialResult.rows.map(mapStudent);
}

async function resolveAssignmentCandidates(teacherId: string, ref: string) {
  const trimmed = ref.trim();
  if (!trimmed) return [];

  if (/^\d+$/.test(trimmed)) {
    const result = await pool.query(
      `
        SELECT id as assignment_id, title, subject, total_marks, created_at
        FROM public.assignments
        WHERE teacher_id = $1 AND id = $2
        LIMIT 1;
      `,
      [teacherId, Number(trimmed)],
    );
    if (result.rows.length > 0) return result.rows.map(mapAssignment);
  }

  const exactTitleResult = await pool.query(
    `
      SELECT id as assignment_id, title, subject, total_marks, created_at
      FROM public.assignments
      WHERE teacher_id = $1 AND LOWER(title) = LOWER($2)
      ORDER BY created_at DESC, id DESC
      LIMIT 5;
    `,
    [teacherId, trimmed],
  );
  if (exactTitleResult.rows.length > 0) return exactTitleResult.rows.map(mapAssignment);

  const partialResult = await pool.query(
    `
      SELECT id as assignment_id, title, subject, total_marks, created_at
      FROM public.assignments
      WHERE teacher_id = $1 AND title ILIKE $2
      ORDER BY
        CASE WHEN title ILIKE $3 THEN 0 ELSE 1 END,
        created_at DESC,
        id DESC
      LIMIT 5;
    `,
    [teacherId, `%${trimmed}%`, `${trimmed}%`],
  );
  if (partialResult.rows.length > 0) return partialResult.rows.map(mapAssignment);

  const tokens = tokenizeAssignmentReference(trimmed);
  if (tokens.length === 0) return [];

  const tokenValues: string[] = [];
  const tokenFilters = tokens.map((token) => {
    const alternatives = assignmentTokenAlternatives(token);
    const filters = alternatives.map((alternative) => {
      tokenValues.push(`%${alternative}%`);
      const param = `$${tokenValues.length + 1}`;
      return `title ILIKE ${param} OR subject ILIKE ${param}`;
    });
    return `(${filters.join(' OR ')})`;
  });
  const tokenResult = await pool.query(
    `
      SELECT id as assignment_id, title, subject, total_marks, created_at
      FROM public.assignments
      WHERE teacher_id = $1
        AND ${tokenFilters.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT 5;
    `,
    [teacherId, ...tokenValues],
  );

  return tokenResult.rows.map(mapAssignment);
}

function resolutionResult<T>(query: string, candidates: T[]) {
  const status: EntityStatus =
    candidates.length === 0 ? 'not_found' : candidates.length === 1 ? 'resolved' : 'multiple_matches';

  return {
    query,
    status,
    match: status === 'resolved' ? candidates[0] : null,
    candidates: status === 'multiple_matches' ? candidates : [],
  };
}

async function resolveStudentOrNull(teacherId: string, studentRef: string) {
  const candidates = await resolveStudentCandidates(teacherId, studentRef);
  return candidates.length === 1 ? candidates[0] : null;
}

export const resolveTAContext = async (req: Request, res: Response) => {
  try {
    const teacherId = requireTeacherId(req, res);
    if (!teacherId) return;

    const students = Array.isArray(req.body?.students) ? req.body.students.map(normalizeText).filter(Boolean) : [];
    const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments.map(normalizeText).filter(Boolean) : [];

    if (students.length === 0 && assignments.length === 0) {
      return res.status(400).json({ error: 'students or assignments array is required' });
    }

    const studentResults = [];
    for (const student of students) {
      studentResults.push(resolutionResult(student, await resolveStudentCandidates(teacherId, student)));
    }

    const assignmentResults = [];
    for (const assignment of assignments) {
      assignmentResults.push(resolutionResult(assignment, await resolveAssignmentCandidates(teacherId, assignment)));
    }

    return res.status(200).json({
      message: 'TA context resolved',
      data: {
        students: studentResults,
        assignments: assignmentResults,
      },
    });
  } catch (error: any) {
    console.error('Error resolving TA context:', error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};

export const getTAStudentOverview = async (req: Request, res: Response) => {
  try {
    const teacherId = requireTeacherId(req, res);
    if (!teacherId) return;

    const studentRef = normalizeText(req.params['studentRef']);
    const student = await resolveStudentOrNull(teacherId, studentRef);
    if (!student) {
      return res.status(404).json({ error: 'Student not found or the reference is ambiguous' });
    }

    const gradesResult = await pool.query(
      `
        SELECT
          assignments.id as assignment_id,
          assignments.title,
          assignments.subject,
          assignments.total_marks as assignment_total_marks,
          SUM(scores.marks)::float as marks_obtained,
          COUNT(scores.*)::int as graded_question_count,
          assignments.created_at
        FROM public.student_question_scores scores
        INNER JOIN public.assignments
          ON assignments.id = scores.assignment_id
          AND assignments.teacher_id = $1
        WHERE scores.teacher_id = $1 AND scores.student_id = $2
        GROUP BY assignments.id, assignments.title, assignments.subject, assignments.total_marks, assignments.created_at
        ORDER BY assignments.created_at DESC, assignments.id DESC;
      `,
      [teacherId, student.student_uuid],
    );

    const summary = gradesResult.rows.reduce(
      (acc, row) => {
        const marks = Number(row.marks_obtained ?? 0);
        const total = Number(row.assignment_total_marks ?? 0);
        acc.total_marks_obtained += marks;
        acc.total_possible_marks += total;
        return acc;
      },
      { graded_assignment_count: gradesResult.rows.length, total_marks_obtained: 0, total_possible_marks: 0 },
    );

    return res.status(200).json({
      message: 'Student overview retrieved successfully',
      data: {
        student,
        summary,
        graded_assignments: gradesResult.rows.map((row) => ({
          assignment_id: row.assignment_id,
          title: row.title,
          subject: row.subject,
          assignment_total_marks: row.assignment_total_marks,
          marks_obtained: row.marks_obtained,
          graded_question_count: row.graded_question_count,
          created_at: toIso(row.created_at),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching TA student overview:', error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};

export const getTAAssignmentOverview = async (req: Request, res: Response) => {
  try {
    const teacherId = requireTeacherId(req, res);
    if (!teacherId) return;

    const assignmentId = Number(req.params['assignmentId']);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Valid assignmentId path param is required' });
    }

    const assignmentResult = await pool.query(
      `
        SELECT id as assignment_id, title, subject, total_marks, created_at
        FROM public.assignments
        WHERE teacher_id = $1 AND id = $2;
      `,
      [teacherId, assignmentId],
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found or you are not authorized to view it' });
    }

    const statsResult = await pool.query(
      `
        WITH question_count AS (
          SELECT COUNT(*)::int as count
          FROM public.questions
          WHERE teacher_id = $1 AND assignment_id = $2
        ),
        submissions AS (
          SELECT COUNT(DISTINCT student_id)::int as submitted_count
          FROM public.student_answers
          WHERE teacher_id = $1 AND assignment_id = $2
        ),
        student_totals AS (
          SELECT student_id, SUM(marks)::float as marks_obtained, COUNT(*)::int as graded_question_count
          FROM public.student_question_scores
          WHERE teacher_id = $1 AND assignment_id = $2
          GROUP BY student_id
        )
        SELECT
          (SELECT count FROM question_count) as question_count,
          (SELECT submitted_count FROM submissions) as submitted_count,
          COUNT(student_totals.student_id)::int as graded_student_count,
          COALESCE(AVG(student_totals.marks_obtained), 0)::float as class_average,
          COALESCE(MAX(student_totals.marks_obtained), 0)::float as highest_score,
          COALESCE(MIN(student_totals.marks_obtained), 0)::float as lowest_score
        FROM student_totals;
      `,
      [teacherId, assignmentId],
    );

    return res.status(200).json({
      message: 'Assignment overview retrieved successfully',
      data: {
        assignment: mapAssignment(assignmentResult.rows[0]),
        syllabus: await getAssignmentSyllabus(assignmentId),
        stats: statsResult.rows[0],
      },
    });
  } catch (error: any) {
    console.error('Error fetching TA assignment overview:', error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};

export const getTAStudentAssignmentPerformance = async (req: Request, res: Response) => {
  try {
    const teacherId = requireTeacherId(req, res);
    if (!teacherId) return;

    const studentRef = normalizeText(req.params['studentRef']);
    const assignmentId = Number(req.params['assignmentId']);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Valid assignmentId path param is required' });
    }

    const student = await resolveStudentOrNull(teacherId, studentRef);
    if (!student) {
      return res.status(404).json({ error: 'Student not found or the reference is ambiguous' });
    }

    const assignmentResult = await pool.query(
      `
        SELECT id as assignment_id, title, subject, total_marks, created_at
        FROM public.assignments
        WHERE teacher_id = $1 AND id = $2;
      `,
      [teacherId, assignmentId],
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found or you are not authorized to view it' });
    }

    const scoresResult = await pool.query(
      `
        SELECT id, question_label, student_solution, marks, confidence_score, ai_comment, teacher_comment, created_at, updated_at
        FROM public.student_question_scores
        WHERE teacher_id = $1 AND student_id = $2 AND assignment_id = $3
        ORDER BY id ASC;
      `,
      [teacherId, student.student_uuid, assignmentId],
    );

    const totalMarks = scoresResult.rows.reduce((sum, row) => sum + Number(row.marks ?? 0), 0);
    const weaknesses = scoresResult.rows
      .map((row) => normalizeText(row.ai_comment))
      .filter(Boolean);

    return res.status(200).json({
      message: 'Student assignment performance retrieved successfully',
      data: {
        student,
        assignment: mapAssignment(assignmentResult.rows[0]),
        syllabus: await getAssignmentSyllabus(assignmentId),
        total_marks: totalMarks,
        graded_question_count: scoresResult.rows.length,
        weaknesses,
        scores: scoresResult.rows.map((row) => ({
          id: row.id,
          question_label: row.question_label,
          student_solution: row.student_solution,
          marks: row.marks === null || row.marks === undefined ? null : Number(row.marks),
          confidence_score:
            row.confidence_score === null || row.confidence_score === undefined ? null : Number(row.confidence_score),
          ai_comment: row.ai_comment,
          teacher_comment: row.teacher_comment,
          created_at: toIso(row.created_at),
          updated_at: toIso(row.updated_at),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching TA student assignment performance:', error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};

export const getTAAssignmentMistakes = async (req: Request, res: Response) => {
  try {
    const teacherId = requireTeacherId(req, res);
    if (!teacherId) return;

    const assignmentId = Number(req.params['assignmentId']);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Valid assignmentId path param is required' });
    }

    const assignmentResult = await pool.query(
      `
        SELECT id as assignment_id, title, subject, total_marks, created_at
        FROM public.assignments
        WHERE teacher_id = $1 AND id = $2;
      `,
      [teacherId, assignmentId],
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found or you are not authorized to view it' });
    }

    const mistakesResult = await pool.query(
      `
        SELECT
          scores.question_label,
          scores.ai_comment,
          COUNT(*)::int as affected_count,
          json_agg(
            json_build_object(
              'student_id', students.student_id,
              'name', students.name,
              'display', students.name || ' (' || students.student_id || ')',
              'marks', scores.marks
            )
            ORDER BY students.name ASC
          ) as affected_students
        FROM public.student_question_scores scores
        INNER JOIN public.students
          ON students.teacher_id = scores.teacher_id
          AND students.id = scores.student_id
        WHERE scores.teacher_id = $1
          AND scores.assignment_id = $2
          AND scores.ai_comment IS NOT NULL
          AND btrim(scores.ai_comment) <> ''
        GROUP BY scores.question_label, scores.ai_comment
        ORDER BY affected_count DESC, scores.question_label ASC
        LIMIT 25;
      `,
      [teacherId, assignmentId],
    );

    return res.status(200).json({
      message:
        mistakesResult.rows.length === 0
          ? 'No AI mistake comments found for this assignment'
          : 'Assignment mistakes retrieved successfully',
      data: {
        assignment: mapAssignment(assignmentResult.rows[0]),
        count: mistakesResult.rows.length,
        mistakes: mistakesResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching TA assignment mistakes:', error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};

export const getTAStudentWeakConcepts = async (req: Request, res: Response) => {
  try {
    const teacherId = requireTeacherId(req, res);
    if (!teacherId) return;

    const studentRef = normalizeText(req.params['studentRef']);
    const student = await resolveStudentOrNull(teacherId, studentRef);
    if (!student) {
      return res.status(404).json({ error: 'Student not found or the reference is ambiguous' });
    }

    const conceptsResult = await pool.query(
      `
        SELECT
          weak.id,
          weak.weakness_score,
          weak.created_at,
          concepts.id as concept_id,
          concepts.subject,
          concepts.name,
          concepts.description,
          COALESCE(
            json_agg(
              json_build_object(
                'id', remediation.id,
                'generated_question', remediation.generated_question,
                'difficulty', remediation.difficulty,
                'created_at', remediation.created_at
              )
              ORDER BY remediation.created_at DESC
            ) FILTER (WHERE remediation.id IS NOT NULL),
            '[]'::json
          ) as remediation_exercises
        FROM public.student_weak_concepts weak
        INNER JOIN public.concepts
          ON concepts.id = weak.concept_id
        LEFT JOIN public.remediation_exercises remediation
          ON remediation.student_id::text = weak.student_id::text
          AND remediation.concept_id = weak.concept_id
        WHERE weak.teacher_id = $1 AND weak.student_id::text = $2
        GROUP BY weak.id, weak.weakness_score, weak.created_at, concepts.id, concepts.subject, concepts.name, concepts.description
        ORDER BY weak.weakness_score DESC NULLS LAST, weak.created_at DESC;
      `,
      [teacherId, student.student_uuid],
    );

    return res.status(200).json({
      message:
        conceptsResult.rows.length === 0
          ? 'No weak concepts found for this student'
          : 'Student weak concepts retrieved successfully',
      data: {
        student,
        count: conceptsResult.rows.length,
        weak_concepts: conceptsResult.rows.map((row) => ({
          id: row.id,
          concept_id: row.concept_id,
          subject: row.subject,
          name: row.name,
          description: row.description,
          weakness_score: row.weakness_score === null || row.weakness_score === undefined ? null : Number(row.weakness_score),
          created_at: toIso(row.created_at),
          remediation_exercises: row.remediation_exercises ?? [],
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching TA student weak concepts:', error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};

export const resolveStudentForController = resolveStudentOrNull;
