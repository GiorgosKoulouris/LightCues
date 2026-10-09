import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLog, lineSplitter, timestamp } from './log';

describe('createLog', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lightcues-logs-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const folder = () => join(dir, 'logs');
  const read = (name: string) => readFileSync(join(folder(), name), 'utf8');

  it("appends lines to today's file, creating the folder", () => {
    const log = createLog(folder(), () => new Date(2026, 9, 9, 14, 30));

    log.write('Engine started');
    log.write('Engine exited with code 1');

    expect(readdirSync(folder())).toEqual(['lightcues-2026-10-09.log']);
    expect(read('lightcues-2026-10-09.log').split('\n')).toEqual([
      `${timestamp(new Date(2026, 9, 9, 14, 30))} Engine started`,
      `${timestamp(new Date(2026, 9, 9, 14, 30))} Engine exited with code 1`,
      '',
    ]);
  });

  it('starts a new file when the day changes', () => {
    let now = new Date(2026, 9, 9, 23, 59);
    const log = createLog(folder(), () => now);

    log.write('before midnight');
    now = new Date(2026, 9, 10, 0, 1);
    log.write('after midnight');

    expect(readdirSync(folder()).sort()).toEqual([
      'lightcues-2026-10-09.log',
      'lightcues-2026-10-10.log',
    ]);
    expect(read('lightcues-2026-10-10.log')).toContain('after midnight');
  });

  it('starts every line of a multi-line message with a timestamp', () => {
    const now = new Date(2026, 9, 9, 14, 30);
    const log = createLog(folder(), () => now);

    log.write('Error: boom\n    at engine.ts:1');

    expect(read('lightcues-2026-10-09.log')).toBe(
      `${timestamp(now)} Error: boom\n${timestamp(now)}     at engine.ts:1\n`,
    );
  });

  it('keeps the last 14 days, today included', () => {
    const logs = folder();
    createLog(logs, () => new Date(2026, 9, 9)).write('make the folder');
    for (const day of ['2026-09-25', '2026-09-26', '2026-10-01']) {
      writeFileSync(join(logs, `lightcues-${day}.log`), 'old');
    }

    createLog(logs, () => new Date(2026, 9, 9, 8));

    expect(readdirSync(logs).sort()).toEqual([
      'lightcues-2026-09-26.log',
      'lightcues-2026-10-01.log',
      'lightcues-2026-10-09.log',
    ]);
  });

  it('removes only lightcues-*.log files', () => {
    const logs = folder();
    createLog(logs, () => new Date(2026, 9, 9)).write('make the folder');
    const others = ['notes.txt', 'other-2026-01-01.log', 'lightcues-2026-01-01.txt'];
    for (const name of others) writeFileSync(join(logs, name), 'keep');

    createLog(logs, () => new Date(2026, 9, 9));

    expect(readdirSync(logs).sort()).toEqual([...others, 'lightcues-2026-10-09.log'].sort());
  });

  it('never throws when the folder cannot be written', () => {
    const blocked = join(dir, 'file');
    writeFileSync(blocked, '');
    const log = createLog(join(blocked, 'logs'), () => new Date(2026, 9, 9));

    expect(() => log.write('lost')).not.toThrow();
  });
});

describe('timestamp', () => {
  it('is the local time in ISO 8601 with its UTC offset', () => {
    const date = new Date(2026, 9, 9, 14, 30, 5, 7);
    const stamp = timestamp(date);

    expect(stamp).toMatch(/^2026-10-09T14:30:05\.007[+-]\d{2}:\d{2}$/);
    expect(new Date(stamp).getTime()).toBe(date.getTime());
  });
});

describe('lineSplitter', () => {
  it('passes on whole lines across chunks', () => {
    const lines: string[] = [];
    const split = lineSplitter((line) => lines.push(line));

    split.push('one\ntw');
    split.push('o\r\nthree');
    expect(lines).toEqual(['one', 'two']);

    split.end();
    expect(lines).toEqual(['one', 'two', 'three']);
  });

  it('drops empty lines and has nothing to flush after a newline', () => {
    const lines: string[] = [];
    const split = lineSplitter((line) => lines.push(line));

    split.push('one\n\n');
    split.end();

    expect(lines).toEqual(['one']);
  });
});
