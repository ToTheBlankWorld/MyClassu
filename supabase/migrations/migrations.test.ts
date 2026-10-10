import fs from 'node:fs';
import path from 'node:path';
import { WEEKDAYS } from '../../src/domain/models';

/**
 * Structural validation of the SQL migrations. There is no live database in
 * CI, so these tests pin the invariants that matter: the full table set
 * exists, constraints use controlled vocabularies that match the TypeScript
 * domain, every user-owned table is protected by RLS, and no permissive
 * catch-all policy sneaks in.
 */

const MIGRATIONS_DIR = path.join(__dirname);

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.sql'))
  .sort();

const sql = migrationFiles
  .map(file => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
  .join('\n');

const TABLES = [
  'profiles',
  'courses',
  'class_sessions',
  'attendance_records',
  'skip_reasons',
  'notification_settings',
  'email_settings',
  'report_log',
];

const ATTENDANCE_STATUSES = ['attended', 'skipped', 'pending', 'unconfirmed'];

describe('database migrations', () => {
  it('exist as SQL files', () => {
    expect(migrationFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('defines every foundational table', () => {
    for (const table of TABLES) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it('constrains weekday to the same controlled set as the domain model', () => {
    for (const weekday of WEEKDAYS) {
      expect(sql).toContain(`'${weekday}'`);
    }
  });

  it('constrains attendance status to the domain attendance states', () => {
    for (const status of ATTENDANCE_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('enforces row level security on every user-owned table', () => {
    const enabled = sql.match(/enable row level security/g) ?? [];
    expect(enabled.length).toBeGreaterThanOrEqual(TABLES.length);
  });

  it('scopes every policy to auth.uid() — no permissive catch-alls', () => {
    const policies = sql.match(/create policy "[^"]+"/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(TABLES.length);
    expect(sql.toLowerCase()).not.toContain('using (true)');
    expect(sql.toLowerCase()).not.toContain('with check (true)');
    expect((sql.match(/auth\.uid\(\)/g) ?? []).length).toBeGreaterThanOrEqual(
      TABLES.length,
    );
  });

  it('keeps one attendance record per session occurrence', () => {
    expect(sql).toContain('unique (class_session_id, date)');
  });

  it('ledgers email reports idempotently', () => {
    expect(sql).toContain('unique (user_id, report_date, kind)');
    expect(sql).toContain('unique (idempotency_key)');
    expect(sql).toContain("check (kind in ('daily', 'weekly'))");
    expect(sql).toContain("check (status in ('sending', 'sent', 'failed'))");
  });

  it('lets users read only their own report ledger', () => {
    expect(sql).toContain('report_log_select_own');
  });

  it('requires sessions to end after they start', () => {
    expect(sql).toContain('check (end_time > start_time)');
  });

  it('profiles default to Asia/Kolkata', () => {
    expect(sql).toContain("default 'Asia/Kolkata'");
  });

  it('uses the product defaults (5-minute reminder, 18:00 report)', () => {
    expect(sql).toContain('reminder_minutes int not null default 5');
    expect(sql).toContain("report_time time not null default '18:00'");
  });
});
