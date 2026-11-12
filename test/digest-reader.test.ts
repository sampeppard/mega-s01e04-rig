import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, and keeps the last status and error', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const fixtures = rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures.runs).toBe(4);
    expect(fixtures.retries).toBe(3);
    expect(fixtures.lastStatus).toBe('ok');
    expect(fixtures.lastError).toBe('upstream 503');
    expect(fixtures.first).toBe('2026-10-29T01:30:00+01:00'); // offset kept
    expect(fixtures.last).toBe('2026-10-29T01:37:00+01:00');
    const backup = rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('counts log lines by status for the night', () => {
    expect(readNight('runs', '2026-10-28')!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(readNight('runs', '2026-10-27')!.counts).toEqual({ ok: 7, retry: 0, fail: 0 });
  });

  it('keeps a row whose owner is null', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    expect(rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file or a bad night', () => {
    expect(readNight('runs', '2020-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
    expect(readNight('runs', '2026-10-2')).toBeNull();
  });

  it('renders an empty file as no rows', () => {
    const dir = tempRuns({ '2026-01-01.jsonl': '' });
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts lines that parse but miss fields, and does not throw', () => {
    const dir = tempRuns({
      '2026-01-02.jsonl': [
        '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        'not json',
        '{"at":"2026-01-02T02:00:00+01:00","job":"a","status":"weird","owner":"x"}',
        '[]',
        '',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-01-02')!;
    expect(night.badLines).toBe(3);
    expect(night.rows).toHaveLength(1);
    expect(night.rows[0]!.runs).toBe(1);
  });
});
