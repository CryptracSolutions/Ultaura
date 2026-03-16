-- Health Documents: document storage tables, access log, access tokens, and storage bucket

-- 1. Document status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ultaura_health_document_status') THEN
    EXECUTE 'CREATE TYPE ultaura_health_document_status AS ENUM (''uploading'', ''active'', ''failed'')';
  END IF;
END $$;

-- 2. Documents table
CREATE TABLE IF NOT EXISTS ultaura_health_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  storage_object_key text UNIQUE,
  mime_type text,
  file_extension text,
  file_size_bytes bigint,
  file_iv bytea,
  file_tag bytea,
  file_alg text DEFAULT 'aes-256-gcm',
  file_kid text,
  status ultaura_health_document_status NOT NULL DEFAULT 'uploading',
  uploaded_by_user_id uuid REFERENCES public.users(id),
  updated_by_user_id uuid REFERENCES public.users(id),
  upload_failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  payload_alg text NOT NULL DEFAULT 'aes-256-gcm',
  payload_kid text,
  CONSTRAINT chk_active_document_fields CHECK (
    status != 'active' OR (
      storage_object_key IS NOT NULL
      AND mime_type IS NOT NULL
      AND file_extension IS NOT NULL
      AND file_size_bytes IS NOT NULL
      AND file_iv IS NOT NULL
      AND file_tag IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_health_documents_line_status_created
  ON ultaura_health_documents(line_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_documents_account_status_created
  ON ultaura_health_documents(account_id, status, created_at DESC);

ALTER TABLE ultaura_health_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ultaura_health_documents'
      AND policyname = 'ultaura_health_documents_owner_select'
  ) THEN
    CREATE POLICY ultaura_health_documents_owner_select
      ON ultaura_health_documents FOR SELECT
      USING (is_ultaura_account_owner(account_id) AND can_access_ultaura_health_line(line_id));
  END IF;
END $$;

-- Account/line consistency trigger
DROP TRIGGER IF EXISTS trg_health_documents_account_line ON ultaura_health_documents;
CREATE TRIGGER trg_health_documents_account_line
  BEFORE INSERT OR UPDATE ON ultaura_health_documents
  FOR EACH ROW EXECUTE FUNCTION enforce_health_account_line_consistency();

-- 3. Access log table
CREATE TABLE IF NOT EXISTS ultaura_health_document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  actor_user_id uuid REFERENCES public.users(id),
  action text NOT NULL CHECK (action IN ('preview', 'download')),
  was_successful boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_doc_access_log_line_created
  ON ultaura_health_document_access_log(line_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_doc_access_log_line_doc_created
  ON ultaura_health_document_access_log(line_id, document_id, created_at DESC);

ALTER TABLE ultaura_health_document_access_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ultaura_health_document_access_log'
      AND policyname = 'ultaura_health_doc_access_log_owner_select'
  ) THEN
    CREATE POLICY ultaura_health_doc_access_log_owner_select
      ON ultaura_health_document_access_log FOR SELECT
      USING (is_ultaura_account_owner(account_id) AND can_access_ultaura_health_line(line_id));
  END IF;
END $$;

-- Access log validation trigger
CREATE OR REPLACE FUNCTION validate_health_document_access_log_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ultaura_health_documents
    WHERE id = NEW.document_id
      AND account_id = NEW.account_id
      AND line_id = NEW.line_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Document access log validation failed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_health_doc_access_log ON ultaura_health_document_access_log;
CREATE TRIGGER trg_validate_health_doc_access_log
  BEFORE INSERT ON ultaura_health_document_access_log
  FOR EACH ROW EXECUTE FUNCTION validate_health_document_access_log_insert();

-- 4. Access tokens table
CREATE TABLE IF NOT EXISTS ultaura_health_document_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES ultaura_health_documents(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id),
  action text NOT NULL CHECK (action IN ('preview', 'download')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_doc_tokens_doc_expires
  ON ultaura_health_document_access_tokens(document_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_doc_tokens_expiry_unused
  ON ultaura_health_document_access_tokens(expires_at) WHERE used_at IS NULL;

ALTER TABLE ultaura_health_document_access_tokens ENABLE ROW LEVEL SECURITY;
-- No direct browser read policy — service-managed only

-- 5. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ultaura-health-documents', 'ultaura-health-documents', false)
ON CONFLICT (id) DO NOTHING;
