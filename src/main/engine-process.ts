// Entry point of the engine utilityProcess. The only Electron-aware part of
// the engine: it hands Electron's parentPort to the Electron-free engine.
import { diskShowFiles, diskVenueFiles, fileStorage } from '../engine/file-storage';
import { nodeMidiPorts } from '../engine/midi-ports';
import { nodeSerialPorts } from '../engine/serial-ports';
import { serve } from '../engine/serve';
import { MIDI_INPUT_ARG, PROFILE_LIBRARY_ARG, RECENT_FILES_ARG } from '../shared/protocol';

// The file named by `<arg><path>` among the process arguments.
function fileArg(arg: string) {
  const path = process.argv.find((a) => a.startsWith(arg))?.slice(arg.length);
  return path === undefined ? undefined : fileStorage(path);
}

serve(process.parentPort, {
  storage: fileArg(PROFILE_LIBRARY_ARG),
  venueFiles: diskVenueFiles,
  showFiles: diskShowFiles,
  serialPorts: nodeSerialPorts,
  midiPorts: nodeMidiPorts,
  midiInputStorage: fileArg(MIDI_INPUT_ARG),
  recentFilesStorage: fileArg(RECENT_FILES_ARG),
});
