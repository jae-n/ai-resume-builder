# AI Resume Builder

AI Resume Builder is a full-stack resume generation app with a Flask backend, MySQL storage, Gemini-powered AI resume generation, and a browser-based frontend.

## What it does

- User authentication with email/password registration and login
- Save personal profile data, work history, projects, skills, and education in a secure vault
- Store multiple job descriptions and choose one to tailor your resume
- Generate AI-crafted resumes using Google Gemini
- Export resumes as PDF or plain text
- View resume history and make edits before exporting

## Repository layout

```
backend/
  app.py           ← Flask REST API and app server
  models.py        ← SQLAlchemy models, auth + resume data schema
  requirements.txt ← Python dependencies
  schema.sql       ← MySQL schema definition
  env.example      ← sample environment configuration
frontend/
  index.html       ← single-page app UI
  static/
    css/style.css  ← app styling
    js/app.js      ← frontend logic and API integration
  vercel.json      ← deployment config
README.md          ← project documentation
```

## Prerequisites

- Python 3.11+ (or a compatible Python 3 version)
- MySQL server
- Google Gemini API key
- `pip` available in your Python environment

## Setup

1. Clone the repository:

```bash
git clone <repo-url> "ai builder"
cd "ai builder"
```

2. Create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1  # PowerShell
# or .venv\Scripts\activate.bat for CMD
```

3. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

4. Create the MySQL database:

```sql
CREATE DATABASE resume_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

You can also import the schema if you want:

```bash
mysql -u root -p resume_builder < backend/schema.sql
```

5. Copy `backend/env.example` to `.env` and fill in your values.

```powershell
Copy-Item backend\env.example .env
```

Then update `.env` with:

- `SECRET_KEY`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `GEMINI_API_KEY`
- `PORT` (optional)
- `FRONTEND_URL`

6. Start the backend server:

```bash
python backend/app.py
```

The API will be available at `http://0.0.0.0:5000` by default.

## Environment variables

The backend reads these values from `.env`:

- `SECRET_KEY` — Flask secret key for session cookies
- `DB_HOST` — MySQL host
- `DB_PORT` — MySQL port (default `3306`)
- `DB_NAME` — MySQL database name
- `DB_USER` — MySQL username
- `DB_PASSWORD` — MySQL password
- `GEMINI_API_KEY` — Google Gemini API key
- `PORT` — optional server port
- `FRONTEND_URL` — allowed frontend origin URL

## Running the app

After the backend is running, open the frontend in your browser:

- If the frontend is served by the backend: `http://localhost:5000/`
- Or open `frontend/index.html` in a browser if you want to run the client directly

## Main API endpoints

Base URL: `http://localhost:5000/api/v1`

- `GET /health` — health check and database status
- `POST /auth/register` — register a new user
- `POST /auth/login` — log in an existing user
- `POST /auth/logout` — log out
- `GET /auth/me` — get current user info
- `GET /vault` — load saved profile vault
- `PUT /vault` — save/update profile vault
- `GET /jd` — list saved job descriptions
- `POST /jd` — create a new job description
- `GET /jd/<id>` — get a single job description
- `PUT /jd/<id>` — update a job description
- `DELETE /jd/<id>` — delete a job description
- `GET /resume` — list generated resumes
- `GET /resume/<id>` — retrieve a saved resume
- `PUT /resume/<id>` — update a saved resume
- `DELETE /resume/<id>` — delete a resume
- `POST /resume/generate` — generate a new resume with Gemini
- `POST /export/pdf` — export a resume as PDF
- `POST /export/text` — export a resume as plain text

## Using the app

1. Register or log in.
2. Fill in your profile vault with contact info, summary, work history, projects, skills, and education.
3. Save a job description for the role you want to target.
4. Select a saved JD and choose resume format, tone, and extra instructions.
5. Generate your resume, review it, edit if needed, then export to PDF or text.

## Notes

- The backend uses Flask, Flask-Login, Flask-SQLAlchemy, and Google Gemini.
- Data is persisted in MySQL.
- The frontend is a static single-page app under `frontend/`.

---

Enjoy building resumes with AI! 🎯
