import { useCallback, useEffect, useState } from 'react';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type {
  FixtureImportResult,
  LibraryImportPreview,
  LibraryImportResult,
  ProfileLibraryEntry,
} from '../../../shared/protocol';
import { request } from '../engine-request';
import { libraryFileName } from './profiles';

// The engine's Profile Library, kept in step through engine events.
// Requests that need an answer return a promise of the engine's reply.
export function useProfileLibrary() {
  const [entries, setEntries] = useState<ProfileLibraryEntry[]>([]);
  // Where the Export and Import dialogs start.
  const [folder, setFolder] = useState<string>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'profiles') return;
      setEntries(event.entries);
      setFolder(event.folder);
    });
    window.engine.send({ type: 'listProfiles' });
    return unsubscribe;
  }, []);

  const importOfl = useCallback(
    (json: unknown, manufacturer: string, overwrite = false) =>
      requestImport((requestId) =>
        window.engine.send({ type: 'importOfl', requestId, json, manufacturer, overwrite }),
      ),
    [],
  );

  const importGdtf = useCallback(
    (bytes: Uint8Array, overwrite = false) =>
      requestImport((requestId) =>
        window.engine.send({ type: 'importGdtf', requestId, bytes, overwrite }),
      ),
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

  // Asks for a file and writes the library to it. Resolves to the engine's
  // errors, or undefined when the user cancels the dialog.
  const exportLibrary = useCallback(async (): Promise<string[] | undefined> => {
    const path = await window.dialogs.chooseLibraryToSave(libraryFileName(new Date()), folder);
    if (path === undefined) return undefined;
    const reply = await request((requestId) =>
      window.engine.send({ type: 'exportLibrary', requestId, path }),
    );
    if (reply.type !== 'libraryExported') throw new Error(`Unexpected engine reply: ${reply.type}`);
    return reply.errors;
  }, [folder]);

  // Asks for a library file and has the engine read it as the pending import.
  // Resolves to what replacing the library would do, or undefined when the
  // user cancels the dialog.
  const previewLibraryImport = useCallback(async (): Promise<LibraryImportPreview | undefined> => {
    const path = await window.dialogs.chooseLibraryToOpen(folder);
    if (path === undefined) return undefined;
    const reply = await request((requestId) =>
      window.engine.send({ type: 'previewLibraryImport', requestId, path }),
    );
    if (reply.type !== 'libraryImportPreview') {
      throw new Error(`Unexpected engine reply: ${reply.type}`);
    }
    return reply.preview;
  }, [folder]);

  // Backs up the library and replaces it with the pending import. The new
  // Profile list arrives before the reply.
  const confirmLibraryImport = useCallback(async (): Promise<LibraryImportResult> => {
    const reply = await request((requestId) =>
      window.engine.send({ type: 'confirmLibraryImport', requestId }),
    );
    if (reply.type !== 'libraryImported') throw new Error(`Unexpected engine reply: ${reply.type}`);
    return reply.result;
  }, []);

  const cancelLibraryImport = useCallback(() => {
    window.engine.send({ type: 'cancelLibraryImport' });
  }, []);

  return {
    entries,
    importOfl,
    importGdtf,
    saveProfile,
    deleteProfile,
    exportLibrary,
    previewLibraryImport,
    confirmLibraryImport,
    cancelLibraryImport,
  };
}

// Sends an import command and resolves to the engine's result.
async function requestImport(send: (requestId: number) => void): Promise<FixtureImportResult> {
  const reply = await request(send);
  if (reply.type !== 'fixtureImported') throw new Error(`Unexpected engine reply: ${reply.type}`);
  return reply.result;
}
