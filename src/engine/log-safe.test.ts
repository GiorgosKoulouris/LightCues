import { describe, expect, it } from 'vitest';
import { withoutContents } from './log-safe';

describe('withoutContents', () => {
  it('drops a JSON parse error, which quotes the file', () => {
    let error: unknown;
    try {
      JSON.parse('{"secret": nope}');
    } catch (e) {
      error = e;
    }

    expect(String(withoutContents(error))).not.toContain('secret');
    expect(withoutContents(error)).toBe('The file is not valid JSON.');
  });

  it('keeps other errors, such as a read error with its path', () => {
    const error = new Error("EACCES: permission denied, open 'C:\\midi-input.json'");

    expect(withoutContents(error)).toBe(error);
  });
});
