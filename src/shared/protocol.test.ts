import { describe, expect, it } from 'vitest';
import { isDocumentKind, unsavedMessage } from './protocol';

describe('unsavedMessage', () => {
  it('names one document', () => {
    expect(unsavedMessage(['venue'])).toBe('The Venue Patch has unsaved changes.');
  });

  it('names two documents with "and"', () => {
    expect(unsavedMessage(['show', 'profile'])).toBe(
      'The Show and the Profile have unsaved changes.',
    );
  });

  it('lists three documents with commas', () => {
    expect(unsavedMessage(['show', 'venue', 'profile'])).toBe(
      'The Show, the Venue Patch and the Profile have unsaved changes.',
    );
  });
});

describe('isDocumentKind', () => {
  it('accepts each document kind', () => {
    expect(['show', 'venue', 'profile'].every(isDocumentKind)).toBe(true);
  });

  it('rejects other strings, including inherited keys', () => {
    expect(isDocumentKind('library')).toBe(false);
    expect(isDocumentKind('toString')).toBe(false);
    expect(isDocumentKind('__proto__')).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isDocumentKind(undefined)).toBe(false);
    expect(isDocumentKind(null)).toBe(false);
    expect(isDocumentKind(1)).toBe(false);
    expect(isDocumentKind({ toString: () => 'show' })).toBe(false);
  });
});
