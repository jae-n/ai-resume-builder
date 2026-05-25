# models.py
# SQLAlchemy ORM models — each class maps to one MySQL table.

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from flask_bcrypt import Bcrypt

db     = SQLAlchemy()
bcrypt = Bcrypt()


# Users

class User(UserMixin, db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    email         = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name     = db.Column(db.String(150), nullable=False, default="")
    created_at    = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow,
                              onupdate=datetime.utcnow)

    # One-to-one / one-to-many relationships — cascade keeps DB clean
    personal   = db.relationship("VaultPersonal", back_populates="user",
                                 uselist=False, cascade="all, delete-orphan")
    jobs       = db.relationship("VaultJob",       back_populates="user",
                                 cascade="all, delete-orphan",
                                 order_by="VaultJob.sort_order")
    projects   = db.relationship("VaultProject",   back_populates="user",
                                 cascade="all, delete-orphan",
                                 order_by="VaultProject.sort_order")
    skills     = db.relationship("VaultSkill",     back_populates="user",
                                 cascade="all, delete-orphan",
                                 order_by="VaultSkill.sort_order")
    education  = db.relationship("VaultEducation", back_populates="user",
                                 cascade="all, delete-orphan",
                                 order_by="VaultEducation.sort_order")
    job_descriptions = db.relationship("JobDescription", back_populates="user",
                                       cascade="all, delete-orphan")
    resumes    = db.relationship("Resume", back_populates="user",
                                 cascade="all, delete-orphan")

    def set_password(self, plain: str):
        self.password_hash = bcrypt.generate_password_hash(plain).decode("utf-8")

    def check_password(self, plain: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, plain)

    def to_dict(self) -> dict:
        return {"id": self.id, "email": self.email,
                "full_name": self.full_name,
                "created_at": self.created_at.isoformat()}


# Vault: personal info 

class VaultPersonal(db.Model):
    __tablename__ = "vault_personal"

    id          = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer,     db.ForeignKey("users.id"), nullable=False, unique=True)
    name        = db.Column(db.String(150), nullable=False, default="")
    email       = db.Column(db.String(255), nullable=False, default="")
    phone       = db.Column(db.String(50),  nullable=False, default="")
    location    = db.Column(db.String(150), nullable=False, default="")
    linkedin    = db.Column(db.String(255), nullable=False, default="")
    github      = db.Column(db.String(255), nullable=False, default="")
    website     = db.Column(db.String(255), nullable=False, default="")
    citizenship = db.Column(db.String(100), nullable=False, default="")
    summary     = db.Column(db.Text,        nullable=True)
    updated_at  = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow,
                            onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="personal")

    def to_dict(self) -> dict:
        return {"name": self.name, "email": self.email, "phone": self.phone,
                "location": self.location, "linkedin": self.linkedin,
                "github": self.github, "website": self.website,
                "citizenship": self.citizenship, "summary": self.summary or ""}


# Vault: work history 

class VaultJob(db.Model):
    __tablename__ = "vault_jobs"

    id         = db.Column(db.Integer,      primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer,      db.ForeignKey("users.id"), nullable=False)
    sort_order = db.Column(db.SmallInteger, nullable=False, default=0)
    title      = db.Column(db.String(200),  nullable=False, default="")
    company    = db.Column(db.String(200),  nullable=False, default="")
    location   = db.Column(db.String(150),  nullable=False, default="")
    start_date = db.Column(db.String(50),   nullable=False, default="")
    end_date   = db.Column(db.String(50),   nullable=False, default="")
    bullets    = db.Column(db.Text,         nullable=True)   # newline-separated
    created_at = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="jobs")

    def to_dict(self) -> dict:
        return {"id": self.id, "sort_order": self.sort_order,
                "title": self.title, "company": self.company,
                "location": self.location, "start": self.start_date,
                "end": self.end_date, "bullets": self.bullets or ""}


# Vault: projects

class VaultProject(db.Model):
    __tablename__ = "vault_projects"

    id          = db.Column(db.Integer,      primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer,      db.ForeignKey("users.id"), nullable=False)
    sort_order  = db.Column(db.SmallInteger, nullable=False, default=0)
    name        = db.Column(db.String(200),  nullable=False, default="")
    stack       = db.Column(db.String(255),  nullable=False, default="")
    description = db.Column(db.Text,         nullable=True)  # newline-separated bullets
    created_at  = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow,
                            onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="projects")

    def to_dict(self) -> dict:
        return {"id": self.id, "sort_order": self.sort_order,
                "name": self.name, "stack": self.stack,
                "description": self.description or ""}


# Vault: skills

class VaultSkill(db.Model):
    __tablename__ = "vault_skills"

    id         = db.Column(db.Integer,      primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer,      db.ForeignKey("users.id"), nullable=False)
    sort_order = db.Column(db.SmallInteger, nullable=False, default=0)
    category   = db.Column(db.String(150),  nullable=False, default="")
    skills     = db.Column(db.Text,         nullable=False)  # comma-separated
    created_at = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="skills")

    def to_dict(self) -> dict:
        return {"id": self.id, "sort_order": self.sort_order,
                "category": self.category, "skills": self.skills}


# Vault: education 

class VaultEducation(db.Model):
    __tablename__ = "vault_education"

    id          = db.Column(db.Integer,      primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer,      db.ForeignKey("users.id"), nullable=False)
    sort_order  = db.Column(db.SmallInteger, nullable=False, default=0)
    institution = db.Column(db.String(200),  nullable=False, default="")
    location    = db.Column(db.String(150),  nullable=False, default="")
    degree      = db.Column(db.String(200),  nullable=False, default="")
    field       = db.Column(db.String(200),  nullable=False, default="")
    start_date  = db.Column(db.String(50),   nullable=False, default="")
    end_date    = db.Column(db.String(50),   nullable=False, default="")
    coursework  = db.Column(db.Text,         nullable=True)
    created_at  = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime,     nullable=False, default=datetime.utcnow,
                            onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="education")

    def to_dict(self) -> dict:
        return {"id": self.id, "sort_order": self.sort_order,
                "institution": self.institution, "location": self.location,
                "degree": self.degree, "field": self.field,
                "start": self.start_date, "end": self.end_date,
                "coursework": self.coursework or ""}


# Job descriptions
class JobDescription(db.Model):
    __tablename__ = "job_descriptions"

    id         = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer,     db.ForeignKey("users.id"), nullable=False)
    title      = db.Column(db.String(200), nullable=False, default="")
    company    = db.Column(db.String(200), nullable=False, default="")
    jd_text    = db.Column(db.Text,        nullable=False)
    created_at = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    user    = db.relationship("User",   back_populates="job_descriptions")
    resumes = db.relationship("Resume", back_populates="jd")

    def to_dict(self) -> dict:
        return {"id": self.id, "title": self.title, "company": self.company,
                "jd_text": self.jd_text,
                "created_at": self.created_at.isoformat()}


# Generated resumes
class Resume(db.Model):
    __tablename__ = "resumes"

    id          = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer,     db.ForeignKey("users.id"), nullable=False)
    jd_id       = db.Column(db.Integer,     db.ForeignKey("job_descriptions.id"), nullable=True)
    label       = db.Column(db.String(200), nullable=False, default="")
    resume_json = db.Column(db.Text,        nullable=False)  # full Gemini JSON
    format      = db.Column(db.String(50),  nullable=False, default="chronological")
    tone        = db.Column(db.String(50),  nullable=False, default="professional")
    created_at  = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime,    nullable=False, default=datetime.utcnow,
                            onupdate=datetime.utcnow)

    user = db.relationship("User",           back_populates="resumes")
    jd   = db.relationship("JobDescription", back_populates="resumes")

    def to_dict(self) -> dict:
        import json as _json
        return {"id": self.id, "jd_id": self.jd_id, "label": self.label,
                "resume": _json.loads(self.resume_json),
                "format": self.format, "tone": self.tone,
                "created_at": self.created_at.isoformat(),
                "updated_at": self.updated_at.isoformat()}
