import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { canExecuteWorkflowTransition, WORKFLOW_STATUSES, type WorkflowStatus } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { createId } from '@/lib/security';
import { getSiteSettings } from '@/lib/settings';

const tables = {
  articles: { table: 'articles', domain: 'content' },
  pages: { table: 'pages', domain: 'pages' },
  events: { table: 'events', domain: 'events' },
  publications: { table: 'publications', domain: 'publications' },
} as const;
type Collection = keyof typeof tables;
const schema = z.object({
  status: z.enum(WORKFLOW_STATUSES),
  comment: z.string().max(1000).optional(),
  scheduledAt: z.string().optional(),
}).strict();

export async function POST(req: NextRequest, context: { params: Promise<{ collection: string; id: string }> }) {
  const authentication = await requireApiAuth(req);
  if ('response' in authentication) return authentication.response;
  const auth = authentication.user;
  const { collection: raw, id } = await context.params;
  if (!Object.prototype.hasOwnProperty.call(tables, raw)) return NextResponse.json({ error: 'Unknown content type.' }, { status: 404 });
  const collection = raw as Collection;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid workflow status.' }, { status: 400 });
  const db = await getDb();
  const current = await db.query<{ workflow_status: string; created_by: string | null; title_sw: string }>(
    `SELECT workflow_status,created_by,title_sw FROM ${tables[collection].table} WHERE id=$1`, [id]
  );
  if (!current.rows[0]) return NextResponse.json({ error: 'Content not found.' }, { status: 404 });
  const fromStatus = current.rows[0].workflow_status as WorkflowStatus;
  const toStatus = parsed.data.status;
  if (['approved','rejected'].includes(toStatus) && current.rows[0].created_by === auth.id && auth.roleSlug !== 'super_admin') {
    await logAudit({ userId: auth.id, userEmail: auth.email, userRole: auth.roleSlug, action: 'security.self_approval_blocked', entityType: collection, entityId: id, summary: 'Blocked an attempt to approve or reject own content.' });
    return NextResponse.json({ error: 'For separation of duties, an author cannot approve or reject their own item.' }, { status: 403 });
  }
  const settings = await getSiteSettings();
  const decision = canExecuteWorkflowTransition({
    fromStatus, toStatus, permissions: auth.permissions, roleSlug: auth.roleSlug,
    delegatedPublish: auth.delegatedPublish, isOwner: current.rows[0].created_by === auth.id,
    domain: tables[collection].domain, rules: settings.workflow,
  });
  if (!decision.allowed) {
    await logAudit({ userId: auth.id, userEmail: auth.email, userRole: auth.roleSlug, action: 'security.workflow_denied', entityType: collection, entityId: id, summary: `Blocked workflow transition ${fromStatus} -> ${toStatus}.` });
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }
  let scheduledAt: string | null = null;
  if (toStatus === 'scheduled') {
    const date = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return NextResponse.json({ error: 'Choose a future date and time for scheduled publication.' }, { status: 400 });
    scheduledAt = date.toISOString();
  }
  const set: string[] = ['workflow_status=$1','review_notes=$2','updated_by=$3','updated_at=NOW()'];
  const values: unknown[] = [toStatus,(parsed.data.comment ?? '').trim(),auth.id];
  if (['under_review','changes_requested'].includes(toStatus)) { values.push(auth.id); set.push(`reviewed_by=$${values.length}`); }
  if (['approved','rejected'].includes(toStatus)) { values.push(auth.id); set.push(`approved_by=$${values.length}`); }
  if (toStatus === 'scheduled') { values.push(scheduledAt); set.push(`scheduled_at=$${values.length}`); }
  if (toStatus === 'published') {
    values.push(auth.id); set.push(`published_by=$${values.length}`);
    set.push('published_at=NOW()'); set.push('scheduled_at=NULL');
    set.push("status_sw='published'"); set.push("status_en=CASE WHEN COALESCE(title_en,'')<>'' THEN 'published' ELSE 'draft' END");
  }
  if (toStatus === 'draft' || toStatus === 'changes_requested' || toStatus === 'rejected' || toStatus === 'archived') {
    set.push('scheduled_at=NULL');
    set.push("status_sw='draft'"); set.push("status_en='draft'");
  }
  values.push(id);
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE ${tables[collection].table} SET ${set.join(',')} WHERE id=$${values.length}`, values);
    await tx.query(
      `INSERT INTO workflow_history (id,entity_type,entity_id,from_status,to_status,action,comment,actor_id,actor_name,actor_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [createId('wfh'),collection,id,fromStatus,toStatus,toStatus,parsed.data.comment ?? '',auth.id,auth.fullName,auth.roleSlug]
    );
  });
  await logAudit({ userId: auth.id, userEmail: auth.email, userRole: auth.roleSlug, action: `${collection}.workflow_${toStatus}`, entityType: collection, entityId: id, summary: `Moved “${current.rows[0].title_sw}” from ${fromStatus} to ${toStatus}.` });
  return NextResponse.json({ ok: true, fromStatus, status: toStatus });
}
