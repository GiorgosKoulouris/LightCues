// The log keeps no file contents, but a JSON parse error quotes part of the
// file it failed on. Use on any error from parsing a file before logging it.
export function withoutContents(error: unknown): unknown {
  return error instanceof SyntaxError ? 'The file is not valid JSON.' : error;
}
