import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { isFlagged } from './digest/flags.js';
import { readNight } from './digest/reader.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, NoDigest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) => {
    const status = readStatus(config);
    // Counts come from the digest reader, the same source as the digest page.
    const digests = status.nights.map((n) => ({ night: n, counts: readNight(config.runsDir, n)?.counts ?? null }));
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} digests={digests} />
      </Layout>,
    );
  });

  app.get('/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <NoDigest night={c.req.param('night')} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night.night}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  // Same rows, same order, same flag rule as the page (ADR 0001): both read `readNight`.
  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night) return c.json({ error: 'no run log for that night' }, 404);
    return c.json({
      night: night.night,
      counts: night.counts,
      badLines: night.badLines,
      rows: night.rows.map((row) => ({ ...row, flagged: isFlagged(row) })),
    });
  });

  return app;
}
