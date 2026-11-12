import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight } from './types.js';

// Plan morning-digest § 1. Parse at the edge: after this file, rows are trusted types.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: ReadonlySet<string> = new Set(['ok', 'retry', 'fail']);

type Line = { at: string; job: string; status: JobStatus; owner: string | null; error: string | null };

function parseLine(text: string): Line | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.has(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as JobStatus,
    owner: typeof o.owner === 'string' && o.owner !== '' ? o.owner : null,
    error: typeof o.error === 'string' && o.error !== '' ? o.error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null; // also keeps `night` from walking out of runsDir

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue; // blank lines (and the final newline) are not bad lines
    const line = parseLine(raw);
    if (!line) {
      badLines += 1;
      continue;
    }
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        first: line.at,
        last: line.at,
      });
      continue;
    }
    row.runs += 1;
    if (line.status === 'retry') row.retries += 1;
    row.lastStatus = line.status;
    row.last = line.at;
    if (line.error !== null) row.lastError = line.error;
    if (line.owner !== null) row.owner = line.owner; // newest known owner; null only if never set
  }

  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  const result: Night = { night, rows: sorted, badLines };
  return result;
};
