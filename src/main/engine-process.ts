// Entry point of the engine utilityProcess. The only Electron-aware part of
// the engine: it hands Electron's parentPort to the Electron-free engine.
import { diskVenueFiles, fileStorage } from '../engine/file-storage';
import { serve } from '../engine/serve';
import { PROFILE_LIBRARY_ARG } from '../shared/protocol';

const libraryArg = process.argv.find((arg) => arg.startsWith(PROFILE_LIBRARY_ARG));

serve(process.parentPort, {
  storage: libraryArg ? fileStorage(libraryArg.slice(PROFILE_LIBRARY_ARG.length)) : undefined,
  venueFiles: diskVenueFiles,
});
