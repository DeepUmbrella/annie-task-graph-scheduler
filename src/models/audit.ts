export interface AuditEvent {
  event_id: string;
  workflow_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
