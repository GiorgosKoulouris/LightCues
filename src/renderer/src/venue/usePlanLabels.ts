import { useState } from 'react';

const KEY = 'stagePlan.labels';

// Whether the stage plan shows Fixture labels. Kept on this machine between
// runs, in the window's local storage: not in the Venue Patch, and not undone.
// Shown until turned off.
export function usePlanLabels(): [boolean, (showLabels: boolean) => void] {
  const [showLabels, setShowLabels] = useState(read);
  return [
    showLabels,
    (next) => {
      setShowLabels(next);
      try {
        localStorage.setItem(KEY, String(next));
      } catch (error) {
        console.error('Could not keep the Fixture labels setting.', error);
      }
    },
  ];
}

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch (error) {
    console.error('Could not read the Fixture labels setting; showing them.', error);
    return true;
  }
}
