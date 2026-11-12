import type { DigestRow } from './types.js';

// Plan morning-digest § 2a. One rule for "look at this row", used by the page and the JSON
// (ADR 0001: they must never disagree).
export const RETRY_FLAG_AT = 3;

export function isFlagged(row: DigestRow): boolean {
  return row.retries >= RETRY_FLAG_AT || row.lastStatus === 'fail';
}
