// deno-lint-ignore-file no-explicit-any
/**
 * Supabase Edge Function: send-attendance-report.
 *
 * Invoked on a schedule (pg_cron, 12:30 UTC = 18:00 Asia/Kolkata) with the
 * service role. For every user with daily reports enabled it builds the
 * day's attendance email from server data and delivers it via AgentMail.
 *
 * Secrets (server-side ONLY — never in the app, never in Git):
 *   AGENTMAIL_API_KEY      AgentMail private API key (Edge Function secret)
 *   AGENTMAIL_FROM_ADDRESS verified sender, e.g. reports@myclassu.app
 * Supabase-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Reliability contract:
 * - The report_log row (idempotency key `daily:<user>:<date>`) is inserted
 *   as `sending` BEFORE the provider call; a concurrent/retried invocation
 *   hits the unique constraint and stops — never a duplicate email.
 * - The row moves to `sent` only after AgentMail confirms acceptance
 *   (provider message id stored); any failure records `failed` + error.
 * - Users without classes get the concise no-classes report only when
 *   their preference allows it; undecided classes are never marked missed.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import {
  buildDailyReport,
  istDateKey,
  type ReportClass,
} from '../_shared/attendance-report.ts';
import { sendViaAgentMail } from '../_shared/agentmail.ts';
const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const REASON_LABELS: Record<string, string> = {
  study: 'Study',
  work: 'Work',
  personal: 'Personal',
  health: 'Health',
  overslept: 'Overslept',
  entertainment: 'Entertainment',
  other: 'Other',
};

/** Monday-first weekday name for a YYYY-MM-DD key (pure calendar math). */
function weekdayOf(dateKey: string): string {
  const utcDay = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return WEEKDAYS[(utcDay + 6) % 7];
}

/** Monday ("YYYY-MM-DD") of the week containing the key. */
function weekStartOf(dateKey: string): string {
  const index = WEEKDAYS.indexOf(
    weekdayOf(dateKey) as (typeof WEEKDAYS)[number],
  );
  const noon = Date.parse(`${dateKey}T12:00:00Z`) - index * 86_400_000;
  const date = new Date(noon);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const agentmailKey = Deno.env.get('AGENTMAIL_API_KEY') ?? '';
  const fromAddress = Deno.env.get('AGENTMAIL_FROM_ADDRESS') ?? '';
  if (!supabaseUrl || !serviceKey || !agentmailKey || !fromAddress) {
    return Response.json(
      { ok: false, error: 'missing server configuration' },
      { status: 500 },
    );
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const dateKey = istDateKey(Date.now());
  const todayWeekday = weekdayOf(dateKey);

  const { data: recipients, error: recipientsError } = await admin
    .from('email_settings')
    .select('user_id,email_address')
    .eq('enabled', true);
  if (recipientsError) {
    return Response.json(
      { ok: false, error: 'recipients query failed' },
      { status: 500 },
    );
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const recipient of (recipients ?? []) as Array<{
    user_id: string;
    email_address: string | null;
  }>) {
    if (!recipient.email_address) {
      continue;
    }
    const idempotencyKey = `daily:${recipient.user_id}:${dateKey}`;
    // Claim the send first: concurrent/retried runs stop here, not inboxes.
    const { error: claimError } = await admin.from('report_log').insert({
      user_id: recipient.user_id,
      report_date: dateKey,
      kind: 'daily',
      idempotency_key: idempotencyKey,
      status: 'sending',
    });
    if (claimError) {
      skipped += 1;
      continue;
    }

    const fail = async (error: string): Promise<void> => {
      await admin
        .from('report_log')
        .update({ status: 'failed', error: error.slice(0, 500) })
        .eq('idempotency_key', idempotencyKey);
      failed += 1;
    };

    const [{ data: sessions }, { data: records }] = await Promise.all([
      admin
        .from('class_sessions')
        .select('id,weekday,start_time,end_time,room,courses(code,title)')
        .eq('user_id', recipient.user_id)
        .eq('weekday', todayWeekday),
      admin
        .from('attendance_records')
        .select('class_session_id,status,reason_category,reason_text')
        .eq('user_id', recipient.user_id)
        .eq('date', dateKey),
    ]);
    const bySession = new Map(
      ((records ?? []) as Array<Record<string, unknown>>).map(row => [
        row['class_session_id'],
        row,
      ]),
    );
    const classes: ReportClass[] = [];
    for (const session of (sessions ?? []) as Array<Record<string, any>>) {
      const decision = bySession.get(session['id']) as
        | {
            status: string;
            reason_category: string | null;
            reason_text: string | null;
          }
        | undefined;
      const course = (session['courses'] ?? {}) as {
        code?: unknown;
        title?: unknown;
      };
      const reasonValue =
        typeof decision?.reason_category === 'string'
          ? decision.reason_category
          : undefined;
      classes.push({
        subject: typeof course.title === 'string' ? course.title : 'Class',
        courseCode: typeof course.code === 'string' ? course.code : '',
        timeLabel: `${String(session['start_time'] ?? '').slice(
          0,
          5,
        )} – ${String(session['end_time'] ?? '').slice(0, 5)}`,
        room:
          typeof session['room'] === 'string'
            ? (session['room'] as string)
            : undefined,
        status:
          decision?.status === 'attended'
            ? 'attended'
            : decision?.status === 'skipped'
            ? 'skipped'
            : 'undecided',
        reasonLabel: reasonValue
          ? REASON_LABELS[reasonValue] ?? reasonValue
          : undefined,
        customReason:
          typeof decision?.reason_text === 'string' &&
          decision.reason_text !== ''
            ? decision.reason_text
            : undefined,
      });
    }
    classes.sort((a, b) => (a.timeLabel < b.timeLabel ? -1 : 1));

    // Week-to-date from this week's decided records (Monday-first).
    const weekStart = weekStartOf(dateKey);
    const { data: weekRecords } = await admin
      .from('attendance_records')
      .select('status')
      .eq('user_id', recipient.user_id)
      .gte('date', weekStart)
      .lte('date', dateKey);
    const weekDecided = (
      (weekRecords ?? []) as Array<{ status: string }>
    ).filter(row => row.status === 'attended' || row.status === 'skipped');
    const weekAttended = weekDecided.filter(
      row => row.status === 'attended',
    ).length;

    const report = buildDailyReport({
      userId: recipient.user_id,
      dateKey,
      dateLabel: dateKey,
      classes,
      weekToDate: {
        attended: weekAttended,
        missed: weekDecided.length - weekAttended,
      },
    });
    if (!report) {
      await fail('empty report');
      continue;
    }
    const delivery = await sendViaAgentMail(fetch, agentmailKey, {
      from: fromAddress,
      to: recipient.email_address,
      subject: report.subject,
      text: report.text,
    });
    if (!delivery.ok) {
      await fail(delivery.error ?? 'delivery failed');
      continue;
    }
    await admin
      .from('report_log')
      .update({
        status: 'sent',
        provider_message_id: delivery.messageId ?? null,
      })
      .eq('idempotency_key', idempotencyKey);
    sent += 1;
  }
  return Response.json({ ok: true, sent, skipped, failed });
});
