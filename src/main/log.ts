import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Days of log files kept, today included.
const KEEP_DAYS = 14;
const LOG_FILE = /^lightcues-(\d{4})-(\d{2})-(\d{2})\.log$/;

export interface Log {
  write(message: string): void;
}

// A log of one file per local day in `folder`, named
// `lightcues-YYYY-MM-DD.log`. Every line starts with a timestamp. Files older
// than the last KEEP_DAYS days are removed on creation. Writes are
// synchronous, so a crash right after loses nothing, and never throw: a log
// that cannot be written must not stop the app.
export function createLog(folder: string, now: () => Date): Log {
  try {
    mkdirSync(folder, { recursive: true });
    removeOldFiles(folder, now());
  } catch {
    // Writes retry the folder.
  }
  return {
    write(message) {
      const date = now();
      const stamp = timestamp(date);
      const lines = message.split(/\r?\n/).map((line) => `${stamp} ${line}\n`);
      try {
        mkdirSync(folder, { recursive: true });
        appendFileSync(join(folder, `lightcues-${day(date)}.log`), lines.join(''));
      } catch {
        // Nowhere left to report it.
      }
    },
  };
}

function removeOldFiles(folder: string, today: Date): void {
  const oldest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS + 1);
  for (const name of readdirSync(folder)) {
    const match = LOG_FILE.exec(name);
    if (!match) continue;
    const [, year, month, date] = match.map(Number);
    if (new Date(year!, month! - 1, date!) < oldest) rmSync(join(folder, name), { force: true });
  }
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function day(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local time in ISO 8601 with its UTC offset, e.g. 2026-10-09T14:30:05.007+03:00.
export function timestamp(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const zone = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return `${day(date)}T${time}.${pad(date.getMilliseconds(), 3)}${zone}`;
}

// Turns a stream of text chunks into whole lines. Empty lines are dropped.
// `end` passes on a last line with no newline.
export function lineSplitter(onLine: (line: string) => void): {
  push(chunk: string): void;
  end(): void;
} {
  let rest = '';
  return {
    push(chunk) {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const line of lines) if (line !== '') onLine(line);
    },
    end() {
      if (rest !== '') onLine(rest);
      rest = '';
    },
  };
}
