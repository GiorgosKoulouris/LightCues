// Entry point of the engine utilityProcess. The only Electron-aware part of
// the engine: it hands Electron's parentPort to the Electron-free engine.
import { dirname, join } from 'node:path';
import {
  diskLibraryBackups,
  diskLibraryFiles,
  diskShowFiles,
  diskVenueFiles,
  fileStorage,
} from '../engine/file-storage';
import { nodeMidiPorts } from '../engine/midi-ports';
import { nodeSerialPorts } from '../engine/serial-ports';
import { serve } from '../engine/serve';
import {
  LIBRARY_BACKUPS_FOLDER,
  MIDI_INPUT_ARG,
  PROFILE_LIBRARY_ARG,
  RECENT_FILES_ARG,
} from '../shared/protocol';

// The path given as `<arg><path>` among the process arguments.
function pathArg(arg: string) {
  return process.argv.find((a) => a.startsWith(arg))?.slice(arg.length);
}

function fileArg(arg: string) {
  const path = pathArg(arg);
  return path === undefined ? undefined : fileStorage(path);
}

const libraryPath = pathArg(PROFILE_LIBRARY_ARG);
// Backups sit in their folder beside the library file.
const libraryBackups =
  libraryPath === undefined
    ? undefined
    : diskLibraryBackups(join(dirname(libraryPath), LIBRARY_BACKUPS_FOLDER));

serve(process.parentPort, {
  storage: fileArg(PROFILE_LIBRARY_ARG),
  libraryFiles: diskLibraryFiles,
  libraryBackups,
  venueFiles: diskVenueFiles,
  showFiles: diskShowFiles,
  serialPorts: nodeSerialPorts,
  midiPorts: nodeMidiPorts,
  midiInputStorage: fileArg(MIDI_INPUT_ARG),
  recentFilesStorage: fileArg(RECENT_FILES_ARG),
});
