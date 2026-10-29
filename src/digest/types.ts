// The digest's shared contract (plan.md § 1). Everything in section 2 builds against this file.
export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—"
  runs: number;
  retries: number; // lines with status "retry"
  lastStatus: JobStatus;
  lastError: string | null;
  first: string; // `at` of the earliest line
  last: string; // `at` of the latest line
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse, counted and never thrown
};

// Reads runs/<night>.jsonl. Returns null when the night has no file (the route answers 404);
// an empty file gives rows: [] (the page says "nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
