import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, ReadNight } from './types.js';

type Line = { at: string; job: string; status: JobStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

function parseLine(text: string): Line | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const { at, job, status, owner, error } = v;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  return { at, job, status: status as JobStatus, owner, error: typeof error === 'string' ? error : null };
}

export const readNight: ReadNight = (runsDir, night) => {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const byJob = new Map<string, Line[]>();
  let badLines = 0;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const list = byJob.get(line.job) ?? [];
    list.push(line);
    byJob.set(line.job, list);
  }
  const rows: DigestRow[] = [...byJob.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([job, lines]) => {
      const sorted = [...lines].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const firstLine = sorted[0]!;
      const lastLine = sorted[sorted.length - 1]!;
      return {
        job,
        owner: lastLine.owner,
        runs: lines.length,
        retries: lines.filter((l) => l.status === 'retry').length,
        lastStatus: lastLine.status,
        lastError: lastLine.error,
        first: firstLine.at,
        last: lastLine.at,
      };
    });
  return { night, rows, badLines };
};
