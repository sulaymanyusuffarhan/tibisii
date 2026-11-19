import { getDb } from './db';
import { anonymizeVisitorSession, createId } from './security';
import { logger } from './logger';

export async function logAudit(params: {
  userId?: string | null;
  userEmail?: string;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO audit_logs
       (id, user_id, user_email, user_role, action, entity_type, entity_id, summary, details_json, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
      [
        createId('aud'),
        params.userId ?? null,
        params.userEmail ?? 'system',
        params.userRole ?? '',
        params.action,
        params.entityType ?? '',
        params.entityId ?? '',
        params.summary.slice(0, 500),
        JSON.stringify(params.details ?? {}),
        (params.ipAddress ?? '').slice(0, 64),
        (params.userAgent ?? '').slice(0, 240),
      ]
    );
  } catch (error) {
    // Audit persistence failure must not hide the original request result, but remains observable.
    logger.error('audit.write_failed', error, { action: params.action, entityType: params.entityType || 'unknown' });
  }
}

export async function logWorkflowTransition(params: {
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  comment?: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
}): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO workflow_history
     (id, entity_type, entity_id, from_status, to_status, action, comment, actor_id, actor_name, actor_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      createId('wfh'),
      params.entityType,
      params.entityId,
      params.fromStatus,
      params.toStatus,
      params.action,
      (params.comment ?? '').slice(0, 1000),
      params.actorId ?? null,
      params.actorName,
      params.actorRole,
    ]
  );
}

export async function recordAnalyticsEvent(params: {
  eventType: 'page_view' | 'publication_download' | 'search';
  path: string;
  entityType?: string;
  entityId?: string;
  label?: string;
  language?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    const sessionHash = anonymizeVisitorSession(params.ip || '0.0.0.0', params.userAgent || '');
    await db.query(
      `INSERT INTO analytics_events
       (id, event_type, path, entity_type, entity_id, label, language, session_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        createId('ana'),
        params.eventType,
        params.path.split(/[?#]/, 1)[0].replace(/[\u0000-\u001f]/g, '').slice(0, 240),
        (params.entityType ?? '').slice(0, 80),
        (params.entityId ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 120),
        (params.label ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 200),
        params.language === 'en' ? 'en' : 'sw',
        sessionHash,
      ]
    );
  } catch (error) {
    logger.warn('analytics.write_failed', { errorType: error instanceof Error ? error.name : 'UnknownError', eventType: params.eventType });
  }
}
