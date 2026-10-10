import type { AppInfo, MidiInputStatus, OutputStatus, TempoSource } from '../../../shared/protocol';
import type { TempoState } from '../panel/useTempo';

// What a bug report needs: main's app info and the engine state the renderer
// already has. Undefined while not known.
export interface Diagnostics {
  app: AppInfo | undefined;
  outputs: OutputStatus[] | undefined;
  midiInput: MidiInputStatus | undefined;
  tempo: TempoState | undefined;
}

const UNKNOWN = 'unknown';

// Follows the BPM on the Tempo line.
const TEMPO_SOURCE_SUFFIXES: Record<TempoSource, string> = {
  default: ', default',
  clock: ' from MIDI Clock',
  held: ' held, MIDI Clock lost',
  tap: ' from Tap Tempo',
};

// Plain text for a bug report, one value per line. No document contents and
// no file paths except the log folder.
export function diagnosticsText({ app, outputs, midiInput, tempo }: Diagnostics): string {
  const lines = [
    'LightCues diagnostics',
    `App version: ${app?.appVersion ?? UNKNOWN}`,
    `Electron version: ${app?.electronVersion ?? UNKNOWN}`,
    `Windows version: ${app?.windowsVersion ?? UNKNOWN}`,
    `Log folder: ${app?.logFolder ?? UNKNOWN}`,
    ...outputLines(outputs),
    `MIDI ports: ${midiInput ? listOrNone(midiInput.ports) : UNKNOWN}`,
    `MIDI Input: ${midiInputText(midiInput)}`,
    `Tempo: ${tempo ? `${Math.round(tempo.bpm)} BPM${TEMPO_SOURCE_SUFFIXES[tempo.source]}` : UNKNOWN}`,
  ];
  return lines.join('\n') + '\n';
}

function outputLines(outputs: OutputStatus[] | undefined): string[] {
  if (!outputs) return [`Outputs: ${UNKNOWN}`];
  if (outputs.length === 0) return ['Outputs: none'];
  return [
    'Outputs:',
    ...outputs.map((o) => `  ${o.name} (${o.id}): ${withError(o.state, o.error)}`),
  ];
}

function midiInputText(status: MidiInputStatus | undefined): string {
  if (!status) return UNKNOWN;
  if (status.selected === undefined) return 'none';
  return `${status.selected} (${withError(status.state, status.error)})`;
}

function withError(state: string, error: string | undefined): string {
  return error ? `${state}: ${error}` : state;
}

function listOrNone(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'none';
}
