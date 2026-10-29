import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.rows).toHaveLength(5);
    expect(night!.badLines).toBe(1);
    const jobs = night!.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
    const fixtures = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, first: '2026-10-29T01:30:00+01:00', last: '2026-10-29T01:37:00+01:00' });
  });

  it('keeps a row with a null owner', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
  });

  it('returns null for a missing night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });
});
