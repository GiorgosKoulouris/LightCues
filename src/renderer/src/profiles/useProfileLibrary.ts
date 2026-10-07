import { useCallback, useEffect, useState } from 'react';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { OflImportResult, ProfileLibraryEntry } from '../../../shared/protocol';
import { request } from '../engine-request';

// The engine's Profile Library, kept in step through engine events.
// Requests that need an answer return a promise of the engine's reply.
export function useProfileLibrary() {
  const [entries, setEntries] = useState<ProfileLibraryEntry[]>([]);

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type === 'profiles') setEntries(event.entries);
    });
    window.engine.send({ type: 'listProfiles' });
    return unsubscribe;
  }, []);

  const importOfl = useCallback(
    async (json: unknown, manufacturer: string, overwrite = false): Promise<OflImportResult> => {
      const reply = await request((requestId) =>
        window.engine.send({ type: 'importOfl', requestId, json, manufacturer, overwrite }),
      );
      if (reply.type !== 'oflImported') throw new Error(`Unexpected engine reply: ${reply.type}`);
      return reply.result;
    },
    [],
  );

  // Resolves to validation errors; an empty list means it was saved.
  const saveProfile = useCallback(
    async (profile: FixtureProfile, replaces?: string): Promise<string[]> => {
      const reply = await request((requestId) =>
        window.engine.send({ type: 'saveProfile', requestId, profile, replaces }),
      );
      if (reply.type !== 'profileSaved') throw new Error(`Unexpected engine reply: ${reply.type}`);
      return reply.errors;
    },
    [],
  );

  const deleteProfile = useCallback((id: string) => {
    window.engine.send({ type: 'deleteProfile', id });
  }, []);

  return { entries, importOfl, saveProfile, deleteProfile };
}
