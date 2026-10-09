# SkillGap AI

A full-stack career-readiness app that compares a resume/profile with a job description, explains skill gaps, and creates a learning roadmap.

## Features
- React + Vite frontend
- Flask REST API
- SQLite persistence for analysis history
- PDF resume text extraction with PyMuPDF
- Deterministic skill matching and transparent weighted score
- Optional OpenAI-powered skill extraction and roadmap generation
- Rule-based fallback when no API key is configured
- Basic input validation and safe handling of uploaded PDFs

## Requirements
- Python 3.10+
- Node.js 18+
- An OpenAI API key is optional; without it, rule-based matching and roadmap generation still work.

## Run locally

### 1. Backend
Open a terminal in `backend/`:

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
# Copy .env.example to .env and optionally add OPENAI_API_KEY
python app.py
```

The API runs at http://127.0.0.1:5000.

### 2. Frontend
Open another terminal in `frontend/`:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually http://localhost:5173.

## Environment variables
Backend `.env`:
- `OPENAI_API_KEY` — optional
- `OPENAI_MODEL` — optional, defaults to `gpt-4o-mini`
- `FRONTEND_ORIGIN` — optional, defaults to `http://localhost:5173`
- `MAX_CONTENT_LENGTH_MB` — optional, defaults to 5

## API
- `GET /api/health`
- `POST /api/analyze` — JSON: `{ "resume_text": "...", "job_description": "...", "use_ai": true }`
- `POST /api/analyze-pdf` — multipart fields `resume` (PDF), `job_description`, optional `use_ai`
- `GET /api/history`
- `GET /api/history/<id>`

## Notes
- The match score is a heuristic indicator of overlap with skills detected in the job description. It is not a hiring probability or a guarantee of qualification.
- AI outputs can be inaccurate. Review suggested skills, resources and plans before relying on them.
- For a real deployment, add authentication, per-user authorization, rate limiting, HTTPS, stronger upload scanning, and a privacy/deletion policy.
