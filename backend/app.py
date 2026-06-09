"""
AI Resume Builder — Flask REST API with MySQL
All data is stored in MySQL via SQLAlchemy ORM.
Auth uses Flask-Login + bcrypt (session cookies).

Setup:
  1. mysql -u root -p < schema.sql
  2. cp .env.example .env  and fill in your values
  3. pip install -r requirements.txt
  4. python app.py
"""

import os
import json
from io import BytesIO
from datetime import datetime

from flask import Flask, request, jsonify, send_file, render_template, g
from flask_restful import Api, Resource

from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from dotenv import load_dotenv

from google import genai

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph,
                                Spacer, HRFlowable, Table, TableStyle)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

from models import db, bcrypt, User, VaultPersonal, VaultJob, VaultProject
from models import VaultSkill, VaultEducation, JobDescription, Resume, SavedPrompt

# keep the ping active
import threading
import time
import requests



#  Bootstrap 

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

ALLOWED_ORIGINS = [
    "http://localhost:5000",
    "http://localhost:3000",
    "https://ai-resume-builder-ot69.vercel.app"
]

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_response("")
        origin = request.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
            response.headers['Access-Control-Max-Age'] = '86400'
        return response

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

# Config
# Secret key — required, no fallback
secret_key = os.environ.get("SECRET_KEY")
if not secret_key:
    raise ValueError("SECRET_KEY environment variable is not set.")
app.config["SECRET_KEY"] = secret_key

# Database — required, no fallback
db_user     = os.environ.get("DB_USER")
db_password = os.environ.get("DB_PASSWORD")
db_host     = os.environ.get("DB_HOST")
db_port     = os.environ.get("DB_PORT", "3306")
db_name     = os.environ.get("DB_NAME")

if not all([db_user, db_password, db_host, db_name]):
    raise ValueError("Database environment variables are not set. Check DB_USER, DB_PASSWORD, DB_HOST, DB_NAME in your .env file.")

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    f"?charset=utf8mb4&ssl_verify_cert=false"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Secure cookie settings
app.config["SESSION_COOKIE_SECURE"]   = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "None" 

db.init_app(app)
bcrypt.init_app(app)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5000")


api_v1 = Api(app, prefix="/api/v1")

login_manager = LoginManager(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return {"error": "Authentication required. Please log in."}, 401

#  Vault text builder (for Gemini prompt) 

def build_vault_text(user: User) -> str:
    """Convert a user's full vault into a structured plain-text block for the AI."""
    lines = ["=== CANDIDATE PROFILE ==="]
    p = user.personal
    if p:
        for label, val in [("Name", p.name), ("Email", p.email), ("Phone", p.phone),
                           ("Location", p.location), ("LinkedIn", p.linkedin),
                           ("GitHub", p.github), ("Website", p.website),
                           ("Citizenship", p.citizenship)]:
            if val and val.strip():
                lines.append(f"{label}: {val.strip()}")
        if p.summary and p.summary.strip():
            lines += ["", "=== PROFESSIONAL SUMMARY ===", p.summary.strip()]

    if user.jobs:
        lines.append("\n=== WORK HISTORY ===")
        for j in user.jobs:
            lines.append(f"\n{j.title} at {j.company} ({j.start_date} - {j.end_date})")
            if j.location:
                lines.append(f"Location: {j.location}")
            if j.bullets and j.bullets.strip():
                lines.append(j.bullets.strip())

    if user.projects:
        lines.append("\n=== PROJECTS ===")
        for proj in user.projects:
            header = proj.name
            if proj.stack:
                header += f" | {proj.stack}"
            lines.append(f"\n{header}")
            if proj.description and proj.description.strip():
                lines.append(proj.description.strip())

    if user.skills:
        lines.append("\n=== SKILLS ===")
        for sk in user.skills:
            prefix = f"{sk.category}: " if sk.category else ""
            lines.append(f"{prefix}{sk.skills}")

    if user.education:
        lines.append("\n=== EDUCATION ===")
        for edu in user.education:
            lines.append(f"\n{edu.degree} in {edu.field}")
            lines.append(f"{edu.institution}, {edu.location} ({edu.start_date} - {edu.end_date})")
            if edu.coursework and edu.coursework.strip():
                lines.append(f"Coursework: {edu.coursework.strip()}")

    return "\n".join(lines)

# Gemini helper    

def call_gemini(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text
    except Exception as e:
        raise ValueError(str(e))

# PDF builder template

def build_pdf(resume: dict) -> bytes:
    buffer = BytesIO()
    W = letter[0] - 0.2*inch
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                        leftMargin=0.1*inch, rightMargin=0.1*inch,
                        topMargin=0.1*inch,  bottomMargin=0.1*inch)

    def s(name, **kw):
        base = dict(fontName="Helvetica", fontSize=10, leading=13, spaceAfter=0, spaceBefore=0)
        base.update(kw)
        return ParagraphStyle(name, **base)

    S_NAME    = s("Name",    fontName="Helvetica-Bold", fontSize=16, leading=20, alignment=TA_CENTER, spaceAfter=2)
    S_CONTACT = s("Contact", fontSize=9.5, leading=13, alignment=TA_CENTER, spaceAfter=1)
    S_LINKS   = s("Links",   fontSize=9.5, leading=13, alignment=TA_CENTER, spaceAfter=6,
                  textColor=colors.HexColor("#1155CC"))
    S_SECTION = s("Section", fontName="Helvetica-Bold", fontSize=10.5, leading=14, spaceBefore=8, spaceAfter=1)
    S_BODY    = s("Body",    fontSize=10, leading=13, spaceAfter=2)
    S_ITALIC  = s("Italic",  fontName="Helvetica-Oblique", fontSize=9.5, leading=12, spaceAfter=2,
                  textColor=colors.HexColor("#333333"))
    S_BULLET  = s("Bullet",  fontSize=10, leading=13, leftIndent=14, spaceAfter=2)
    S_PNAME   = s("ProjName",fontName="Helvetica-Bold", fontSize=10, leading=13, spaceAfter=1)
    S_PBULLET = s("ProjBull",fontSize=10, leading=13, leftIndent=28, spaceAfter=2)
    S_SKILL   = s("Skill",   fontSize=10, leading=13, spaceAfter=3)

    def section_block(title):
        return [Paragraph(title.upper(), S_SECTION),
                HRFlowable(width="100%", thickness=0.8, color=colors.black, spaceAfter=4)]

    def lr_table(left, right, ls=None, rs=None):
        ls = ls or s("L", fontName="Helvetica-Bold", fontSize=10, leading=13)
        rs = rs or s("R", fontSize=10, leading=13, alignment=TA_RIGHT)
        t = Table([[Paragraph(left, ls), Paragraph(right, rs)]],
                  colWidths=[W*0.72, W*0.28])
        t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),
                               ("LEFTPADDING",(0,0),(-1,-1),0),
                               ("RIGHTPADDING",(0,0),(-1,-1),0),
                               ("TOPPADDING",(0,0),(-1,-1),0),
                               ("BOTTOMPADDING",(0,0),(-1,-1),2)]))
        return t

    story = []

    # Header
    story.append(Paragraph(resume.get("name",""), S_NAME))
    contact = " | ".join(x for x in [resume.get("location",""), resume.get("phone",""),
                                      resume.get("email",""), resume.get("citizenship","")] if x.strip())
    if contact:
        story.append(Paragraph(contact, S_CONTACT))
    links = " | ".join(x for x in [resume.get("linkedin") or "", resume.get("github") or "",
                                resume.get("website") or ""] if x.strip())
    if links:
        story.append(Paragraph(links, S_LINKS))
    story.append(Spacer(1, 4))

    # Render sections in user-defined order 
    section_order = resume.get("section_order") or \
                    ["education", "experience", "research", "projects", "skills"]

    for section in section_order:

        if section == "education":
            edu_entries = resume.get("education_entries") or []
            if not edu_entries: continue
            story += section_block("Education")
            for e in edu_entries:
                institution = e.get("institution") or ""
                location    = e.get("location")    or ""
                degree      = e.get("degree")      or ""
                date        = e.get("date")        or ""
                coursework  = e.get("coursework")  or ""
                if not institution and not degree: continue
                story.append(lr_table(institution, location,
                    ls=s("EL", fontName="Helvetica-Bold", fontSize=10, leading=13),
                    rs=s("ER", fontSize=10, leading=13, alignment=TA_RIGHT, fontName="Helvetica-Oblique")))
                if degree or date:
                    story.append(Paragraph(f"{degree}   {date}".strip(), S_ITALIC))
                if coursework.strip():
                    story.append(Paragraph(f"Relevant Coursework: {coursework}", S_BODY))
                story.append(Spacer(1, 3))

        elif section == "experience":
            if not resume.get("experience"): continue
            story += section_block("Work Experience")
            for job in resume["experience"]:
                date_str = f"{job.get('start','')} - {job.get('end','')}"
                story.append(lr_table(job.get("company",""), date_str,
                    ls=s("CL", fontName="Helvetica-Bold", fontSize=10, leading=13)))
                meta = job.get("title","")
                if job.get("location",""):
                    meta += f"  -  {job['location']}"
                story.append(Paragraph(meta, S_ITALIC))
                for b in job.get("bullets", []):
                    if b and b.strip():
                        story.append(Paragraph(f"• {b.strip().lstrip('•').strip()}", S_BULLET))
                story.append(Spacer(1, 4))

        elif section == "research":
            if not resume.get("research"): continue
            story += section_block("Research Experience")
            for r in resume["research"]:
                date_str = f"{r.get('start','')} - {r.get('end','')}"
                story.append(lr_table(f"{r.get('title','')} | {r.get('institution','')}",
                                      date_str, ls=s("RL", fontName="Helvetica-Bold", fontSize=10, leading=13)))
                for b in r.get("bullets", []):
                    if b and b.strip():
                        story.append(Paragraph(f"• {b.strip().lstrip('•').strip()}", S_BULLET))
                story.append(Spacer(1, 4))

        elif section == "projects":
            if not resume.get("projects"): continue
            story += section_block("Personal Projects")
            for proj in resume["projects"]:
                header = f"• {proj.get('name','')}"
                if proj.get("stack",""):
                    header += f" | {proj['stack']}"
                story.append(Paragraph(header, S_PNAME))
                desc = proj.get("desc","")
                bullets = desc if isinstance(desc, list) else [l for l in str(desc).split("\n") if l.strip()]
                for b in bullets:
                    if b and b.strip():
                        story.append(Paragraph(f"• {b.strip().lstrip('•').strip()}", S_PBULLET))
                story.append(Spacer(1, 3))

        elif section == "skills":
            skill_sections = resume.get("skills_sections") or []
            if not skill_sections: continue
            story += section_block("Skills and Interests")
            for sk in skill_sections:
                category = sk.get("category") or ""
                values   = sk.get("values")   or ""
                if not values.strip(): continue
                line = f"<b>{category}:</b> {values}" if category else values
                story.append(Paragraph(line, S_SKILL))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


#  Auth Resources


class AuthRegister(Resource):
    def post(self):
        """POST /api/v1/auth/register — create a new account"""
        body = request.get_json(silent=True) or {}
        email     = body.get("email","").strip().lower()
        password  = body.get("password","")
        full_name = body.get("full_name","").strip()

        if not email or not password:
            return {"error": "email and password are required."}, 400
        if len(password) < 8:
            return {"error": "Password must be at least 8 characters."}, 400
        if User.query.filter_by(email=email).first():
            return {"error": "An account with that email already exists."}, 409

        user = User(email=email, full_name=full_name)
        user.set_password(password)
        # Create empty vault_personal row
        user.personal = VaultPersonal()
        db.session.add(user)
        db.session.commit()

        login_user(user, remember=True)
        return {"message": "Account created.", "user": user.to_dict()}, 201


class AuthLogin(Resource):
    def post(self):
        """POST /api/v1/auth/login"""
        body = request.get_json(silent=True) or {}
        email    = body.get("email","").strip().lower()
        password = body.get("password","")

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return {"error": "Invalid email or password."}, 401

        login_user(user, remember=True)
        return {"message": "Logged in.", "user": user.to_dict()}, 200


class AuthLogout(Resource):
    @login_required
    def post(self):
        """POST /api/v1/auth/logout"""
        logout_user()
        return {"message": "Logged out."}, 200


class AuthMe(Resource):
    @login_required
    def get(self):
        """GET /api/v1/auth/me — current user info"""
        return {"user": current_user.to_dict()}, 200


#  Vault Resources


class VaultResource(Resource):
    @login_required
    def get(self):
        """GET /api/v1/vault — load full vault for current user"""
        u = current_user
        p = u.personal or VaultPersonal()
        return {"vault": {
            "personal":  p.to_dict(),
            "jobs":      [j.to_dict() for j in u.jobs],
            "projects":  [p2.to_dict() for p2 in u.projects],
            "skills":    [s.to_dict() for s in u.skills],
            "education": [e.to_dict() for e in u.education],
        }}, 200

    @login_required
    def put(self):
        """PUT /api/v1/vault — full vault replace"""
        body = request.get_json(silent=True) or {}
        vault = body.get("vault", {})
        u = current_user

        # Personal
        p_data = vault.get("personal", {})
        if not u.personal:
            u.personal = VaultPersonal(user_id=u.id)
            db.session.add(u.personal)
        vp = u.personal
        for field in ("name","email","phone","location","linkedin","github","website","citizenship"):
            setattr(vp, field, p_data.get(field, ""))
        vp.summary = p_data.get("summary","")

        # Jobs — delete old rows, insert fresh
        VaultJob.query.filter_by(user_id=u.id).delete()
        for i, j in enumerate(vault.get("jobs", [])):
            db.session.add(VaultJob(user_id=u.id, sort_order=i,
                title=j.get("title",""), company=j.get("company",""),
                location=j.get("location",""), start_date=j.get("start",""),
                end_date=j.get("end",""), bullets=j.get("bullets","")))

        # Projects
        VaultProject.query.filter_by(user_id=u.id).delete()
        for i, proj in enumerate(vault.get("projects", [])):
            db.session.add(VaultProject(user_id=u.id, sort_order=i,
                name=proj.get("name",""), stack=proj.get("stack",""),
                description=proj.get("description", proj.get("desc",""))))

        # Skills
        VaultSkill.query.filter_by(user_id=u.id).delete()
        for i, sk in enumerate(vault.get("skills", [])):
            db.session.add(VaultSkill(user_id=u.id, sort_order=i,
                category=sk.get("category",""), skills=sk.get("skills","")))

        # Education
        VaultEducation.query.filter_by(user_id=u.id).delete()
        for i, edu in enumerate(vault.get("education", [])):
            db.session.add(VaultEducation(user_id=u.id, sort_order=i,
                institution=edu.get("institution",""), location=edu.get("location",""),
                degree=edu.get("degree",""), field=edu.get("field",""),
                start_date=edu.get("start",""), end_date=edu.get("end",""),
                coursework=edu.get("coursework","")))

        db.session.commit()
        return {"message": "Vault saved.", "saved_at": datetime.utcnow().isoformat()+"Z"}, 200


#  Job Description Resources


class JDList(Resource):
    @login_required
    def get(self):
        """GET /api/v1/jd — list all job descriptions for current user"""
        jds = JobDescription.query.filter_by(user_id=current_user.id)\
                                  .order_by(JobDescription.created_at.desc()).all()
        return {"job_descriptions": [j.to_dict() for j in jds]}, 200

    @login_required
    def post(self):
        """POST /api/v1/jd — save a new job description"""
        body = request.get_json(silent=True) or {}
        jd_data = body.get("jd", {})
        if not jd_data.get("jd_text","").strip():
            return {"error": "jd_text is required."}, 400
        jd = JobDescription(user_id=current_user.id,
                            title=jd_data.get("title",""),
                            company=jd_data.get("company",""),
                            jd_text=jd_data.get("jd_text",""))
        db.session.add(jd)
        db.session.commit()
        return {"message": "Job description saved.", "jd": jd.to_dict()}, 201


class JDDetail(Resource):
    @login_required
    def get(self, jd_id):
        """GET /api/v1/jd/<id>"""
        jd = JobDescription.query.filter_by(id=jd_id, user_id=current_user.id).first()
        if not jd:
            return {"error": "Not found."}, 404
        return {"jd": jd.to_dict()}, 200

    @login_required
    def put(self, jd_id):
        """PUT /api/v1/jd/<id> — update a job description"""
        jd = JobDescription.query.filter_by(id=jd_id, user_id=current_user.id).first()
        if not jd:
            return {"error": "Not found."}, 404
        body = request.get_json(silent=True) or {}
        data = body.get("jd", {})
        jd.title   = data.get("title",   jd.title)
        jd.company = data.get("company", jd.company)
        jd.jd_text = data.get("jd_text", jd.jd_text)
        db.session.commit()
        return {"message": "Updated.", "jd": jd.to_dict()}, 200

    @login_required
    def delete(self, jd_id):
        """DELETE /api/v1/jd/<id>"""
        jd = JobDescription.query.filter_by(id=jd_id, user_id=current_user.id).first()
        if not jd:
            return {"error": "Not found."}, 404
        db.session.delete(jd)
        db.session.commit()
        return {"message": "Deleted."}, 200


#  Resume Resources


class ResumeList(Resource):
    @login_required
    def get(self):
        """GET /api/v1/resume — list all resumes (summaries only)"""
        resumes = Resume.query.filter_by(user_id=current_user.id)\
                              .order_by(Resume.created_at.desc()).all()
        return {"resumes": [{"id": r.id, "label": r.label,
                              "format": r.format, "tone": r.tone,
                              "jd_id": r.jd_id,
                              "created_at": r.created_at.isoformat()} for r in resumes]}, 200


class ResumeDetail(Resource):
    @login_required
    def get(self, resume_id):
        """GET /api/v1/resume/<id>"""
        r = Resume.query.filter_by(id=resume_id, user_id=current_user.id).first()
        if not r:
            return {"error": "Not found."}, 404
        return {"resume": r.to_dict()}, 200

    @login_required
    def put(self, resume_id):
        """PUT /api/v1/resume/<id> — save edits"""
        r = Resume.query.filter_by(id=resume_id, user_id=current_user.id).first()
        if not r:
            return {"error": "Not found."}, 404
        body = request.get_json(silent=True) or {}
        if "resume" in body:
            r.resume_json = json.dumps(body["resume"])
        if "label" in body:
            r.label = body["label"]
        db.session.commit()
        return {"message": "Resume saved.", "resume": r.to_dict()}, 200

    @login_required
    def delete(self, resume_id):
        """DELETE /api/v1/resume/<id>"""
        r = Resume.query.filter_by(id=resume_id, user_id=current_user.id).first()
        if not r:
            return {"error": "Not found."}, 404
        db.session.delete(r)
        db.session.commit()
        return {"message": "Deleted."}, 200


class ResumeGenerate(Resource):
    @login_required
    def post(self):
        """
        POST /api/v1/resume/generate
        Body: { "jd_id": 1, "format": "chronological", "tone": "professional",
                "instructions": "..." }
        Calls Gemini, stores result in DB, returns the resume.
        """
        body    = request.get_json(silent=True) or {}
        jd_id   = body.get("jd_id")
        jd_text = body.get("jd_text","").strip()

        # Accept either a saved jd_id or raw jd_text
        if jd_id:
            jd_row = JobDescription.query.filter_by(id=jd_id, user_id=current_user.id).first()
            if not jd_row:
                return {"error": "Job description not found."}, 404
            jd_text = jd_row.jd_text
        elif not jd_text:
            return {"error": "Provide either jd_id or jd_text."}, 400

        vault_text   = build_vault_text(current_user)
        fmt          = body.get("format", "chronological")
        tone         = body.get("tone",   "professional")
        extra        = body.get("instructions", "")

        prompt = f"""
You are an expert resume writer. Using the candidate profile below, write a tailored resume
for the job description provided.

FORMAT: {fmt}
TONE: {tone}
{f"EXTRA INSTRUCTIONS: {extra}" if extra else ""}

Return ONLY valid JSON — no markdown fences, no extra text — matching this EXACT schema:
{{
  "name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedin": "string",
  "github": "string",
  "website": "string",
  "citizenship": "string",
  "education_entries": [
    {{"institution":"string","location":"string","degree":"string","date":"string","coursework":"string"}}
  ],
  "experience": [
    {{"company":"string","title":"string","start":"string","end":"string","location":"string","bullets":["string"]}}
  ],
  "research": [
    {{"title":"string","institution":"string","start":"string","end":"string","bullets":["string"]}}
  ],
  "projects": [
    {{"name":"string","stack":"string","desc":["string"]}}
  ],
  "skills_sections": [
    {{"category":"string","values":"string"}}
  ]
}}

Rules:
- Only use information from the candidate profile — never invent anything
- Rewrite bullets to highlight keywords from the job description
- Prioritise skills relevant to the JD, grouped by category
- Keep bullets concise and achievement-oriented with metrics where available
- Return [] for sections not in the profile

=== CANDIDATE PROFILE ===
{vault_text}

=== JOB DESCRIPTION ===
{jd_text}
""".strip()

        try:
            raw = call_gemini(prompt)
            raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            resume_data = json.loads(raw)
        except ValueError as e:
            return {"error": str(e)}, 503
        except json.JSONDecodeError as e:
            return {"error": f"Gemini returned invalid JSON: {e}"}, 502
        except Exception as e:
            error_msg = str(e)
            if "quota" in error_msg.lower() or "429" in error_msg:
                return {"error": "Gemini API quota exceeded. Please wait a few minutes and try again, or add billing at console.cloud.google.com"}, 429
            if "expired" in error_msg.lower():
                return {"error": "Gemini API key expired. Please create a new key at aistudio.google.com/app/apikey"}, 401
            return {"error": f"AI service error: {error_msg}"}, 500

        # Auto-label: "Company — Role (Month Year)"
        exp   = resume_data.get("experience", [])
        label = f"{exp[0].get('company','')} — {exp[0].get('title','')}" if exp else "Resume"
        label += f" ({datetime.now().strftime('%b %Y')})"

        r = Resume(user_id=current_user.id, jd_id=jd_id or None,
                   label=label, resume_json=json.dumps(resume_data),
                   format=fmt, tone=tone)
        db.session.add(r)
        db.session.commit()

        return {"resume": r.to_dict(), "generated_at": datetime.utcnow().isoformat()+"Z"}, 201


#  Export Resources


class ExportPDF(Resource):
    @login_required
    def post(self):
        """POST /api/v1/export/pdf  body: { "resume_id": 1 } or { "resume": {...} }"""
        body = request.get_json(silent=True) or {}
        resume_data = body.get("resume")

        if not resume_data and body.get("resume_id"):
            r = Resume.query.filter_by(id=body["resume_id"],
                                       user_id=current_user.id).first()
            if not r:
                return {"error": "Resume not found."}, 404
            resume_data = json.loads(r.resume_json)

        if not resume_data:
            return {"error": "Provide resume_id or resume object."}, 400

        try:
            pdf_bytes = build_pdf(resume_data)
        except Exception as e:
            return {"error": f"PDF generation failed: {e}"}, 500

        name     = resume_data.get("name","resume").replace(" ","_")
        filename = f"{name}_resume_{datetime.now().strftime('%Y%m%d')}.pdf"
        return send_file(BytesIO(pdf_bytes), mimetype="application/pdf",
                         as_attachment=True, download_name=filename)


class ExportText(Resource):
    @login_required
    def post(self):
        """POST /api/v1/export/text  body: { "resume_id": 1 } or { "resume": {...} }"""
        body = request.get_json(silent=True) or {}
        resume_data = body.get("resume")

        if not resume_data and body.get("resume_id"):
            r = Resume.query.filter_by(id=body["resume_id"],
                                       user_id=current_user.id).first()
            if not r:
                return {"error": "Resume not found."}, 404
            resume_data = json.loads(r.resume_json)

        if not resume_data:
            return {"error": "Provide resume_id or resume object."}, 400

        lines = [resume_data.get("name","").upper()]
        contact = "  |  ".join(filter(None,[resume_data.get(k,"")
                    for k in ("location","phone","email","citizenship")]))
        if contact: lines.append(contact)
        lines.append("-"*60)
        for job in resume_data.get("experience",[]):
            lines += [f"\n{job.get('title','')} - {job.get('company','')}",
                      f"{job.get('start','')} - {job.get('end','')}"]
            for b in job.get("bullets",[]): lines.append(f"  • {b}")
        for sk in resume_data.get("skills_sections",[]):
            lines.append(f"\n{sk.get('category','')}: {sk.get('values','')}")
        for edu in resume_data.get("education_entries",[]):
            lines.append(f"\n{edu.get('degree','')} - {edu.get('institution','')}")
        return {"text": "\n".join(lines)}, 200

def keep_alive():
    """Pings the health endpoint every 5 minutes to prevent Render from sleeping."""
    # Wait 30 seconds after startup before first ping
    time.sleep(30)
    url = os.environ.get("https://ai-resume-builder-backend-xi6s.onrender.com", "")
    if not url:
        print("RENDER_EXTERNAL_URL not set — keep alive disabled")
        return
    while True:
        try:
            response = requests.get(f"{url}/api/v1/health", timeout=10)
            print(f"[keep-alive] pinged {url} → {response.status_code}")
        except Exception as e:
            print(f"[keep-alive] ping failed: {e}")
        time.sleep(600)  # 10min

# Start keep-alive thread in production only
if os.environ.get("FLASK_ENV") == "production":
    thread = threading.Thread(target=keep_alive, daemon=True)
    thread.start()
    print("[keep-alive] background thread started")


#  Health


class Health(Resource):
    def get(self):
        try:
            db.session.execute(db.text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False
        return {
            "status": "ok",
            "db": "connected" if db_ok else "error",
            "timestamp": datetime.utcnow().isoformat()+"Z"
        }, 200


class PromptList(Resource):
    @login_required
    def get(self):
        prompts = SavedPrompt.query.filter_by(user_id=current_user.id)\
                                   .order_by(SavedPrompt.created_at.desc()).all()
        return {"prompts": [p.to_dict() for p in prompts]}, 200

    @login_required
    def post(self):
        body  = request.get_json(silent=True) or {}
        name  = body.get("name", "").strip()
        extra = body.get("extra", "").strip()
        if not name or not extra:
            return {"error": "name and extra are required."}, 400
        p = SavedPrompt(
            user_id=current_user.id,
            name=name,
            extra=extra,
            format=body.get("format", "chronological"),
            tone=body.get("tone", "professional")
        )
        db.session.add(p)
        db.session.commit()
        return {"message": "Prompt saved.", "prompt": p.to_dict()}, 201


class PromptDetail(Resource):
    @login_required
    def delete(self, prompt_id):
        p = SavedPrompt.query.filter_by(id=prompt_id, user_id=current_user.id).first()
        if not p:
            return {"error": "Not found."}, 404
        db.session.delete(p)
        db.session.commit()
        return {"message": "Deleted."}, 200

#  Register routes


api_v1.add_resource(Health,          "/health")
api_v1.add_resource(AuthRegister,    "/auth/register")
api_v1.add_resource(AuthLogin,       "/auth/login")
api_v1.add_resource(AuthLogout,      "/auth/logout")
api_v1.add_resource(AuthMe,          "/auth/me")
api_v1.add_resource(VaultResource,   "/vault")
api_v1.add_resource(JDList,          "/jd")
api_v1.add_resource(JDDetail,        "/jd/<int:jd_id>")
api_v1.add_resource(ResumeList,      "/resume")
api_v1.add_resource(ResumeDetail,    "/resume/<int:resume_id>")
api_v1.add_resource(ResumeGenerate,  "/resume/generate")
api_v1.add_resource(ExportPDF,       "/export/pdf")
api_v1.add_resource(ExportText,      "/export/text")
api_v1.add_resource(PromptList,   "/prompts")
api_v1.add_resource(PromptDetail, "/prompts/<int:prompt_id>")

# Serve frontend 

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path=None):
    return render_template("index.html")

#  Run 

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, host="0.0.0.0", port=port)
