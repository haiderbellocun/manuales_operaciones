-- Acervo Operaciones — Esquema PostgreSQL

CREATE TABLE IF NOT EXISTS areas (
  id          VARCHAR(10) PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  code        VARCHAR(10)  NOT NULL,
  color       VARCHAR(50),
  lead_name   VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS document_types (
  id    VARCHAR(30) PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  short VARCHAR(10)  NOT NULL,
  icon  VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS roles (
  id          VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  perms       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS people (
  id         VARCHAR(30) PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  role_title VARCHAR(200),
  area_id    VARCHAR(10) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(10) PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(200) UNIQUE NOT NULL,
  password    VARCHAR(200) NOT NULL,
  role_id     VARCHAR(20) NOT NULL REFERENCES roles(id),
  area_id     VARCHAR(10) REFERENCES areas(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'Activo',
  last_access DATE
);

CREATE TABLE IF NOT EXISTS documents (
  id          VARCHAR(10) PRIMARY KEY,
  area_id     VARCHAR(10) NOT NULL REFERENCES areas(id),
  type_id     VARCHAR(30) NOT NULL REFERENCES document_types(id),
  code        VARCHAR(50)  NOT NULL,
  name        VARCHAR(500) NOT NULL,
  version     VARCHAR(20)  NOT NULL,
  state       VARCHAR(20)  NOT NULL,
  owner_id    VARCHAR(30)  NOT NULL REFERENCES people(id),
  vigencia    VARCHAR(20),
  views       INT NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  tags        JSONB NOT NULL DEFAULT '[]',
  related     JSONB NOT NULL DEFAULT '[]',
  ans_ref     VARCHAR(10),
  cargo_ref   VARCHAR(10),
  app_ref     VARCHAR(10),
  created     DATE,
  updated     DATE
);

CREATE INDEX IF NOT EXISTS idx_documents_area ON documents(area_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type_id);
CREATE INDEX IF NOT EXISTS idx_documents_state ON documents(state);

CREATE TABLE IF NOT EXISTS document_history (
  id             SERIAL PRIMARY KEY,
  doc_id         VARCHAR(10) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version        VARCHAR(20) NOT NULL,
  history_date   DATE NOT NULL,
  by_person_id   VARCHAR(30),
  note           TEXT
);

CREATE TABLE IF NOT EXISTS workflow_items (
  id         VARCHAR(30) PRIMARY KEY,
  doc_id     VARCHAR(10) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  stage      VARCHAR(20) NOT NULL,
  assignee   VARCHAR(200) NOT NULL,
  since_date DATE NOT NULL,
  priority   VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id VARCHAR(10) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_id  VARCHAR(10) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, doc_id)
);

CREATE TABLE IF NOT EXISTS document_files (
  doc_id        VARCHAR(10) PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  original_name VARCHAR(500) NOT NULL,
  stored_name   VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(100),
  file_size     BIGINT NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by   VARCHAR(10) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS update_requests (
  id         VARCHAR(30) PRIMARY KEY,
  doc_id     VARCHAR(10) NOT NULL REFERENCES documents(id),
  user_id    VARCHAR(10) NOT NULL REFERENCES users(id),
  reason     TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id              SERIAL PRIMARY KEY,
  who_person_id   VARCHAR(30),
  action          VARCHAR(200) NOT NULL,
  doc_id          VARCHAR(10),
  when_text       VARCHAR(50)
);
