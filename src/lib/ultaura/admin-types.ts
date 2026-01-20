export interface DebugLog {
  id: string;
  created_at: string;
  call_session_id: string | null;
  account_id: string | null;
  event_type: string;
  tool_name: string | null;
  payload: Record<string, unknown>;
  payload_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  payload_encrypted?: boolean;
  payload_decrypt_failed?: boolean;
}
