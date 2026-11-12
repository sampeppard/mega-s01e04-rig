import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// `runs/` is read-only, so every test builds its own runs dir.
const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

function appWith(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(runsDir, name), text);
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}

const busy = [
  line('2026-11-01T01:00:00+01:00', 'zeta/job', 'ok', 'rook'),
  line('2026-11-01T02:00:00+01:00', 'alpha/job', 'retry', 'rook', 'boom'),
  line('2026-11-01T02:01:00+01:00', 'alpha/job', 'retry', 'rook', 'boom'),
  line('2026-11-01T02:02:00+01:00', 'alpha/job', 'retry', 'rook', 'boom'),
  line('2026-11-01T02:03:00+01:00', 'alpha/job', 'ok', 'rook'),
  line('2026-11-01T03:00:00+01:00', 'mid/job', 'fail', null, 'quota'),
].join('\n') + '\n';

describe('GET /digest/:night', () => {
  it('200: one row per job, sorted by job, flagged rows marked, null owner as —', async () => {
    const res = await appWith({ '2026-11-01.jsonl': busy }).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('alpha/job')).toBeLessThan(html.indexOf('mid/job'));
    expect(html.indexOf('mid/job')).toBeLessThan(html.indexOf('zeta/job'));
    expect(html).toContain('⚠ alpha/job'); // 3 retries
    expect(html).toContain('⚠ mid/job'); // last status fail
    expect(html).not.toContain('⚠ zeta/job');
    expect(html).toContain('<td>—</td>'); // mid/job has no owner
  });

  it('404 for a night with no file', async () => {
    const res = await appWith({}).request('/digest/2026-11-02');
    expect(res.status).toBe(404);
  });

  it('404 for something that is not a night', async () => {
    const res = await appWith({}).request('/digest/not-a-night');
    expect(res.status).toBe(404);
  });

  it('renders an empty file as "nothing ran"', async () => {
    const res = await appWith({ '2026-11-03.jsonl': '' }).request('/digest/2026-11-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('a night with a bad line still renders and says how many lines were skipped', async () => {
    const text = line('2026-11-04T01:00:00+01:00', 'a/job', 'ok', 'rook') + '\n{"at": "cut off\n';
    const res = await appWith({ '2026-11-04.jsonl': text }).request('/digest/2026-11-04');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain('1 line in the log could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the rows as JSON', async () => {
    const res = await appWith({ '2026-11-01.jsonl': busy }).request('/api/digest/2026-11-01');
    const body = (await res.json()) as { night: string; rows: { job: string; flagged: boolean; owner: string | null }[] };
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-11-01');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
    expect(body.rows.map((r) => r.flagged)).toEqual([true, true, false]);
    expect(body.rows[1]!.owner).toBeNull();
  });

  it('404 for a night with no file', async () => {
    const res = await appWith({}).request('/api/digest/2026-11-02');
    expect(res.status).toBe(404);
  });

  it('empty night: 200 with no rows', async () => {
    const res = await appWith({ '2026-11-03.jsonl': '' }).request('/api/digest/2026-11-03');
    const body = (await res.json()) as { rows: unknown[] };
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('a night with a bad line: 200, the line is counted', async () => {
    const text = line('2026-11-04T01:00:00+01:00', 'a/job', 'ok', 'rook') + '\n{"at": "cut off\n';
    const res = await appWith({ '2026-11-04.jsonl': text }).request('/api/digest/2026-11-04');
    const body = (await res.json()) as { badLines: number; rows: unknown[] };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('same jobs in the same order', async () => {
    const app = appWith({ '2026-11-01.jsonl': busy });
    const html = await (await app.request('/digest/2026-11-01')).text();
    const body = (await (await app.request('/api/digest/2026-11-01')).json()) as { rows: { job: string }[] };
    const pageJobs = [...html.matchAll(/<tr[^>]*><td>(?:⚠ )?([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(pageJobs).toEqual(body.rows.map((r) => r.job));
  });
});
