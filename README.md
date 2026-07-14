# TA-AI

AI-powered assessment platform for teachers: upload assignment artifacts, extract structured academic content, auto-grade student submissions, and provide targeted remediation insights.

## Overview
Assess-AI is an open-source, multi-service system built for classroom workflows. It combines:
- A **TypeScript/Express backend** for authentication, data APIs, and orchestration
- A **Python/FastAPI agent service** running specialized LangGraph pipelines
- A **PostgreSQL schema** with assignment, question, rubric, solution, student answer, and score entities
- Optional **Redis caching/rate-limit support** via Upstash

The backend delegates AI-heavy document understanding and grading logic to the agent service through internal APIs.

## Core Features
- Assignment lifecycle management (create, list, search, update, delete)
- Question, rubric, and model-solution ingestion from uploaded files
- Student profile and student-answer ingestion workflows
- AI-assisted grading pipeline for per-question scoring
- Teacher review support (manual score/comment adjustments)
- TA chat endpoint for guided instructional support
- Remediation and weak-concept retrieval APIs
- JWT-based auth and role-aware APIs
- OpenAPI docs via Swagger UI

## Architecture
### Services
- `backend/` — Express + TypeScript REST API (port `8080` in Docker)
- `agent/` — FastAPI + LangGraph AI workflows (port `8000`)

### High-level flow
1. Teacher uploads assignment artifacts (questions/rubrics/solutions/student answers).
2. Backend receives request and forwards processing to FastAPI internal endpoints.
3. Agent parses files (images/PDF/docs), runs specialized graph(s), and returns structured output.
4. Backend persists/retrieves records and exposes teacher/student-facing APIs.
5. Grading endpoint triggers full AI grading workflow and stores score-level outputs.

## Repository Structure
- `backend/src/routes/` — route definitions
- `backend/src/controllers/` — request handlers and orchestration
- `backend/src/lib/` — DB, Redis, logging, JWT utilities
- `backend/src/config/` — environment and OpenAPI setup
- `backend/test/` — Jest tests
- `backend/supabase/migrations/` — SQL migrations
- `agent/main.py` — FastAPI app and AI processing endpoints
- `agent/utils/*_agent/` — task-specific LangGraph agents
- `agent/config/db.py` — DB integration for agent-side operations
- `docker-compose.yml` — local multi-service orchestration

## API Surfaces
### Backend (Express)
Primary groups include:
- `/auth`
- `/users`
- `/assignments`
- grading routes (e.g. `POST /assignments/:assignmentId/students/:studentId/grade`)
- TA chat routes (e.g. `POST /ta/chat`)
- remediation routes (e.g. `POST /remediation/generate`)
- health route (`GET /health`)

Swagger/OpenAPI UI is exposed at:
- `GET /api-docs`

### Agent (FastAPI internal)
Important internal endpoints include:
- `POST /internal/agent/questions/process`
- `POST /internal/agent/rubrics/process`
- `POST /internal/agent/solutions/process`
- `POST /internal/agent/student-answers/process`
- `POST /internal/agent/grade/process`
- `POST /internal/agent/ta/chat`
- `POST /internal/agent/ta/chat/json`

## Tech Stack
### Backend
- Node.js (>= `20.6.0`)
- TypeScript + Express
- PostgreSQL (`pg`)
- JWT auth (`jsonwebtoken`)
- Swagger (`swagger-ui-express`)
- Validation (`zod`)
- Testing (`jest`, `supertest`)

### Agent
- Python (`>=3.12.3`)
- FastAPI + Uvicorn
- LangGraph + LangChain/OpenAI integrations
- Document parsing utilities (`pypdf`, `python-docx`, image/pdf tooling)
- PostgreSQL + Supabase client integrations

## Prerequisites
- Docker + Docker Compose (recommended)
- OR local runtimes:
  - Node.js `>=20.6.0`
  - Python `>=3.12.3`
  - PostgreSQL instance

## Quick Start (Docker)
From repo root:

```bash
docker compose up --build
```

Services:
- Backend: `http://localhost:8080`
- Agent: `http://localhost:8000`

## Local Development (without Docker)
### 1) Backend setup
```bash
cd backend
npm install
npm run dev
```

### 2) Agent setup
Using `uv` (recommended):
```bash
cd agent
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or with `pip`:
```bash
cd agent
pip install -e .
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Environment Variables
Create and populate:
- `backend/.env`
- `agent/.env`

### Backend expected variables
Based on `backend/src/config/env.ts`:
- `NODE_ENV`
- `PORT`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FASTAPI_URL` (used by controllers; defaults to `http://localhost:8000` if unset)

### Agent expected variables
The agent uses `.env` for DB/OpenAI/AWS/document-processing and orchestration settings. Add required secrets for your deployment (e.g., OpenAI keys, DB credentials, optional cloud OCR settings).

> Security note: never commit real `.env` files. Commit sanitized `.env.example` files instead.

## Database & Migrations
- SQL migrations live under `backend/supabase/migrations/`
- Additional SQL/data resources:
  - `agent/seed_data.sql`
  - `agent/single.sql`
  - `schema_dump.txt`

Run migrations using your preferred PostgreSQL/Supabase workflow before starting production workloads.

## Testing
Run backend tests:

```bash
cd backend
npm test
```

## Scripts
### Backend (`backend/package.json`)
- `npm run dev` — start dev server with watch mode
- `npm run build` — compile TypeScript
- `npm start` — run compiled server
- `npm test` — run Jest tests
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`

## Development Notes
- API documentation references: `FRONTEND_API_GUIDE.md` and `api.md`
- Architecture docs: `AGENT_ARCHITECTURE.md`, `agent_architecutre_fix.md`
- Product direction: `PRODUCTION_ROADMAP.md`

## Contributing
Contributions are welcome.

Recommended flow:
1. Fork the repo
2. Create a feature branch
3. Make focused changes with tests where applicable
4. Open a PR with a clear description

Please keep changes minimal, documented, and aligned with existing code style.

## License
Add your license file and update this section accordingly.

Example:
- `MIT` (recommended for open-source collaboration)

## Maintainers
- Project owner: `Shahidul`
- Repository: `https://github.com/HeyMahdy/Assess-AI`
