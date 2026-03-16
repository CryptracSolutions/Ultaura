-- Health Export: document export helper function

CREATE OR REPLACE FUNCTION has_exportable_health_document_files(target_account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ultaura_health_documents d
    WHERE d.account_id = target_account_id AND d.status = 'active'
  );
$$;
