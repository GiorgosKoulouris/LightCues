import { saveShowFile } from '../engine/show-file';
import { saveVenueFile } from '../engine/venue-file';
import type { EngineDocument, EngineSnapshot, EngineSnapshotMessage } from '../shared/protocol';

export function isSnapshotMessage(message: unknown): message is EngineSnapshotMessage {
  return (message as EngineSnapshotMessage | undefined)?.type === 'snapshot';
}

// The engine's latest snapshot, merged from the parts it sends (ADR 0011).
// Kept in memory only: it holds the open documents, which never go to disk
// unless the user saves them. Undefined until a whole one has arrived.
export function createSnapshotStore() {
  let parts: Partial<EngineSnapshot> = {};

  return {
    // `latest` keeps only the parts, not the message type.
    merge(message: EngineSnapshotMessage): void {
      parts = { ...parts, ...message };
    },
    latest(): EngineSnapshot | undefined {
      const { show, venue, playback, midiInput } = parts;
      if (!show || !venue || !playback || !midiInput) return undefined;
      return { show, venue, playback, midiInput };
    },
  };
}

// A document of the snapshot as file JSON, for saving it while the engine is
// down. Throws when the document is invalid, as a save from the engine does.
export function snapshotFile(snapshot: EngineSnapshot, document: EngineDocument): string {
  return document === 'show'
    ? saveShowFile(snapshot.show.document)
    : saveVenueFile(snapshot.venue.document);
}
