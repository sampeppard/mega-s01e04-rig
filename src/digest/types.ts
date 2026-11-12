// Plan morning-digest § 1. The contract every part of the digest builds against.
// Types and signature only: the reader itself is issue #2.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  // `null` when the log line had no owner. Views show it as `—`, the row is never dropped.
  owner: string | null;
  // Every log line for the job, retries included.
  runs: number;
  // How many of those lines had status `retry`.
  retries: number;
  // Status of the job's last line in the file.
  lastStatus: JobStatus;
  // `error` of the job's last line that had one, or `null` if none did.
  lastError: string | null;
  // `at` of the first and last line for the job, exactly as logged (offset kept, never
  // converted to UTC).
  first: string;
  last: string;
};

// How many valid log lines had each status, whole night. Bad lines are not in here.
export type StatusCounts = Record<JobStatus, number>;

export type Night = {
  night: string; // YYYY-MM-DD
  // Rows sorted by job. The page and the JSON both use this order (ADR 0001).
  rows: DigestRow[];
  counts: StatusCounts;
  // Lines that did not parse or did not have the expected fields. Counted, never thrown.
  badLines: number;
};

// Reads `<runsDir>/<night>.jsonl`.
// Returns `null` when the night has no file (or `night` is not a YYYY-MM-DD date), so a route
// can answer 404. An empty file is a night with `rows: []`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
