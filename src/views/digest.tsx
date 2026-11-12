import { isFlagged } from '../digest/flags.js';
import type { Night } from '../digest/types.js';

const dash = '—'; // missing data renders as — (styleguide)

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => {
              const flagged = isFlagged(row);
              return (
                <tr class={flagged ? 'warn' : undefined}>
                  <td>{flagged ? `⚠ ${row.job}` : row.job}</td>
                  <td>{row.owner ?? dash}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? dash}</td>
                  <td>{row.first}</td>
                  <td>{row.last}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} in the log could not be read
        </p>
      ) : null}
      <p class="mute">⚠ = 3 or more retries, or the last run failed</p>
    </>
  );
}

export function NoDigest({ night }: { night: string }) {
  return (
    <>
      <h1>digest</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
