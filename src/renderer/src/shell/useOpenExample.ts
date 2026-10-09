import { useCallback } from 'react';
import type { DocumentKind } from '../../../shared/protocol';
import type { ShowState } from '../show/useShow';
import { useToast } from '../ui/Toast';
import type { VenueState } from '../venue/useVenuePatch';
import { useDiscardUnsaved } from './useFileCommands';

interface OpenedDocument<State> {
  state: State | undefined;
  openAsNew(path: string): Promise<string[]>;
}

// Opens the example Venue Patch and Show that ship with the app, after
// asking before unsaved changes are discarded. Both open as new, so Save asks
// where: the install folder is replaced on update.
export function useOpenExample(show: OpenedDocument<ShowState>, venue: OpenedDocument<VenueState>) {
  const discard = useDiscardUnsaved();
  const toast = useToast();
  const { state: showState, openAsNew: openShow } = show;
  const { state: venueState, openAsNew: openVenue } = venue;

  return useCallback(async () => {
    const unsaved: DocumentKind[] = [
      ...(showState?.unsaved ? (['show'] as const) : []),
      ...(venueState?.unsaved ? (['venue'] as const) : []),
    ];
    if (unsaved.length > 0 && !(await discard(unsaved))) return;
    let errors: string[];
    try {
      const paths = await window.dialogs.openExample();
      errors = [...(await openVenue(paths.venue)), ...(await openShow(paths.show))];
    } catch (error) {
      errors = [(error as Error).message];
    }
    if (errors.length > 0) {
      toast({ tone: 'error', message: `Could not open the example: ${errors.join(' ')}` });
    }
  }, [discard, toast, showState?.unsaved, venueState?.unsaved, openShow, openVenue]);
}

// Nothing is open: no file and no content in either document.
export function nothingOpen(show: ShowState | undefined, venue: VenueState | undefined): boolean {
  return (
    show !== undefined &&
    venue !== undefined &&
    show.path === undefined &&
    venue.path === undefined &&
    show.show.scenes.length === 0 &&
    venue.patch.fixtures.length === 0
  );
}
