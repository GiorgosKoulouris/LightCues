export type View = 'show' | 'venue' | 'profiles' | 'perform';

// In sidebar order; Ctrl+1 is the first.
export const VIEWS: readonly { id: View; label: string }[] = [
  { id: 'show', label: 'Show' },
  { id: 'venue', label: 'Venue Patch' },
  { id: 'profiles', label: 'Profile Library' },
  { id: 'perform', label: 'Perform' },
];
