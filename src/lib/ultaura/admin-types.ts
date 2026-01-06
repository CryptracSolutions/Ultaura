export interface DebugLog {
  id: string;
  created_at: string;
  call_session_id: string | null;
  account_id: string | null;
  event_type: string;
  tool_name: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}
