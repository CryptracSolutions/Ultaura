CREATE OR REPLACE FUNCTION has_exportable_health_profile_data(target_account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM ultaura_health_conditions c WHERE c.account_id = target_account_id AND c.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM ultaura_health_medications m WHERE m.account_id = target_account_id AND m.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM ultaura_health_observations o WHERE o.account_id = target_account_id AND o.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM ultaura_health_item_history h WHERE h.account_id = target_account_id);
$$;
