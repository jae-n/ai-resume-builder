
--  AI Resume Builder — MySQL Schema
--  schema.sql
--
--  Run once:  mysql -u root -p < schema.sql

CREATE TABLE test123 (id INT PRIMARY KEY);

CREATE DATABASE IF NOT EXISTS resume_builder
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE resume_builder;

-- Users 
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL DEFAULT '',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Vault: personal contact info
CREATE TABLE IF NOT EXISTS vault_personal (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL UNIQUE,
  name        VARCHAR(150) NOT NULL DEFAULT '',
  email       VARCHAR(255) NOT NULL DEFAULT '',
  phone       VARCHAR(50)  NOT NULL DEFAULT '',
  location    VARCHAR(150) NOT NULL DEFAULT '',
  linkedin    VARCHAR(255) NOT NULL DEFAULT '',
  github      VARCHAR(255) NOT NULL DEFAULT '',
  website     VARCHAR(255) NOT NULL DEFAULT '',
  citizenship VARCHAR(100) NOT NULL DEFAULT '',
  summary     TEXT,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Vault: work history 
CREATE TABLE IF NOT EXISTS vault_jobs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  title       VARCHAR(200) NOT NULL DEFAULT '',
  company     VARCHAR(200) NOT NULL DEFAULT '',
  location    VARCHAR(150) NOT NULL DEFAULT '',
  start_date  VARCHAR(50)  NOT NULL DEFAULT '',
  end_date    VARCHAR(50)  NOT NULL DEFAULT '',
  bullets     TEXT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Vault: projects 
CREATE TABLE IF NOT EXISTS vault_projects (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  name        VARCHAR(200) NOT NULL DEFAULT '',
  stack       VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

--Vault: skills 
CREATE TABLE IF NOT EXISTS vault_skills (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  category    VARCHAR(150) NOT NULL DEFAULT '',
  skills      TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Vault: education
CREATE TABLE IF NOT EXISTS vault_education (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  institution VARCHAR(200) NOT NULL DEFAULT '',
  location    VARCHAR(150) NOT NULL DEFAULT '',
  degree      VARCHAR(200) NOT NULL DEFAULT '',
  field       VARCHAR(200) NOT NULL DEFAULT '',
  start_date  VARCHAR(50)  NOT NULL DEFAULT '',
  end_date    VARCHAR(50)  NOT NULL DEFAULT '',
  coursework  TEXT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

--  Job descriptions 
CREATE TABLE IF NOT EXISTS job_descriptions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(200) NOT NULL DEFAULT '',
  company     VARCHAR(200) NOT NULL DEFAULT '',
  jd_text     LONGTEXT     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Generated resumes 
CREATE TABLE IF NOT EXISTS resumes (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  jd_id        INT UNSIGNED,
  label        VARCHAR(200) NOT NULL DEFAULT '',
  resume_json  LONGTEXT     NOT NULL,
  format       VARCHAR(50)  NOT NULL DEFAULT 'chronological',
  tone         VARCHAR(50)  NOT NULL DEFAULT 'professional',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (jd_id)   REFERENCES job_descriptions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_prompts (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(200) NOT NULL DEFAULT '',
  extra      TEXT         NOT NULL,
  format     VARCHAR(50)  NOT NULL DEFAULT 'chronological',
  tone       VARCHAR(50)  NOT NULL DEFAULT 'professional',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes 
CREATE INDEX idx_vault_jobs_user      ON vault_jobs(user_id, sort_order);
CREATE INDEX idx_vault_projects_user  ON vault_projects(user_id, sort_order);
CREATE INDEX idx_vault_skills_user    ON vault_skills(user_id, sort_order);
CREATE INDEX idx_vault_education_user ON vault_education(user_id, sort_order);
CREATE INDEX idx_jd_user              ON job_descriptions(user_id);
CREATE INDEX idx_resumes_user         ON resumes(user_id, created_at);
CREATE INDEX idx_saved_prompts_user ON saved_prompts(user_id);






