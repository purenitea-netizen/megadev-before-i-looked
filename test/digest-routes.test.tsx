import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

interface DigestJson {
  night: string;
  badLines: number;
  rows: { job: string }[];
}

function line(job: string, ts: string): string {
  return JSON.stringify({ job, status: 'ok', ts, owner: 'me' });
}

let tmpApp: ReturnType<typeof createApp>;

beforeAll(() => {
  const tmp = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
  writeFileSync(
    join(tmp, '2026-01-02.jsonl'),
    [line('b/job', '2026-01-02T01:00:00+01:00'), 'not json {{', line('a/job', '2026-01-02T01:05:00+01:00')].join('\n') + '\n',
  );
  tmpApp = createApp({ ...base, runsDir: tmp });
});

describe('GET /api/digest/:night', () => {
  it('returns the 5 jobs of 2026-10-28 sorted by job', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.night).toBe('2026-10-28');
    expect(body.rows).toHaveLength(5);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('404s for a night with no file', async () => {
    const res = await tmpApp.request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
  });

  it('returns empty rows for the empty night', async () => {
    const res = await tmpApp.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-01', badLines: 0, rows: [] });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await tmpApp.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });
});

describe('GET /digest/:night', () => {
  it('renders the same jobs in the same order as the JSON', async () => {
    const app = createApp({ ...base, runsDir: 'runs' });
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as DigestJson;
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<table');
    const positions = json.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('404s for a night with no file', async () => {
    const res = await tmpApp.request('/digest/1999-01-01');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for the empty night', async () => {
    const res = await tmpApp.request('/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the good rows when a line is bad', async () => {
    const res = await tmpApp.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
  });
});
