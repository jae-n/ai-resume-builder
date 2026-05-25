# AI Resume Builder

Mobile-friendly web app with a Flask REST API backend, Gemini AI generation, and PDF export.

## Project structure

```
resume_app/
├── app.py               ← Flask REST API (all endpoints)
├── requirements.txt
├── vault.json           ← auto-created when you save your vault
├── jd.json              ← auto-created when you save a job description
├── resume.json          ← auto-created when you generate a resume
└── templates/
    └── index.html       ← mobile-first frontend (single page)
```

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Get a Gemini API key
Go to https://aistudio.google.com/app/apikey and create a free key.

### 3. Set your API key
**Mac / Linux:**
```bash
export GEMINI_API_KEY=your_key_here
```
**Windows (cmd):**
```cmd
set GEMINI_API_KEY=your_key_here
```
**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your_key_here"
```

### 4. Run the server
```bash
python app.py
```

The server starts on `http://0.0.0.0:5000` — accessible from your phone and any device on the same Wi-Fi.

### 5. Open on your phone
1. Find your computer's local IP (e.g. `192.168.1.42`)  
   - Mac: System Settings → Wi-Fi → Details  
   - Windows: `ipconfig` in cmd → look for IPv4 Address  
2. Open `http://192.168.1.42:5000` in your phone's browser


## REST API reference

Base URL: `http://localhost:5000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | API status + Gemini key check |
| GET | /vault | Load profile vault |
| PUT | /vault | Save profile vault |
| GET | /jd | Load job description |
| PUT | /jd | Save job description |
| GET | /resume | Load last generated resume |
| PUT | /resume | Save edited resume |
| DELETE | /resume | Clear current resume |
| POST | /resume/generate | Generate resume via Gemini |
| POST | /export/pdf | Download resume as PDF |
| POST | /export/text | Get plain-text resume |

### Generate endpoint body
```json
{
  "jd_text": "Full job description text...",
  "format": "chronological",
  "tone": "professional",
  "instructions": "Keep to one page"
}
```

## How to use

1. **Vault tab** — enter your info once (name, jobs, projects, skills, education). Tap **Save vault**.
2. **Job Desc tab** — paste the job posting. Tap **Save job description**.
3. **Generate tab** — pick format/tone, tap **Generate resume**. Gemini tailors it to the JD.
4. **Edit tab** — tweak any section. Tap **Save edits**.
5. **Preview tab** — review the final resume. Tap **Export PDF** to download.
