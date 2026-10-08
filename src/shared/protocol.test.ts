import { describe, expect, it } from 'vitest';
import { unsavedMessage } from './protocol';

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
