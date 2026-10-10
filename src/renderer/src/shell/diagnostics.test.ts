import { describe, expect, it } from 'vitest';
import { diagnosticsText, type Diagnostics } from './diagnostics';

const LOG_FOLDER = 'C:\\Users\\sam\\AppData\\Roaming\\LightCues\\logs';

const FULL: Diagnostics = {
  app: {
    appVersion: '0.2.0',
    electronVersion: '44.7.0',
    windowsVersion: '10.0.22631',
    logFolder: LOG_FOLDER,
  },
  outputs: [
    { id: 'EN123456', name: 'DMX USB PRO', state: 'sending' },
    { id: 'COM4', name: 'Open DMX', state: 'failed', error: 'Access denied' },
  ],
  midiInput: {
    ports: ['loopMIDI Port', 'Launchpad'],
    selected: 'loopMIDI Port',
    state: 'connected',
  },
  tempo: { bpm: 127.6, source: 'clock' },
};

describe('diagnosticsText', () => {
  it('lists every field', () => {
    expect(diagnosticsText(FULL)).toBe(
      [
        'LightCues diagnostics',
        'App version: 0.2.0',
        'Electron version: 44.7.0',
        'Windows version: 10.0.22631',
        `Log folder: ${LOG_FOLDER}`,
        'Outputs:',
        '  DMX USB PRO (EN123456): sending',
        '  Open DMX (COM4): failed: Access denied',
        'MIDI ports: loopMIDI Port, Launchpad',
        'MIDI Input: loopMIDI Port (connected)',
        'Tempo: 128 BPM from MIDI Clock',
        '',
      ].join('\n'),
    );
  });

  it('shows unknown for values not known yet', () => {
    const text = diagnosticsText({
      app: undefined,
      outputs: undefined,
      midiInput: undefined,
      tempo: undefined,
    });
    expect(text).toBe(
      [
        'LightCues diagnostics',
        'App version: unknown',
        'Electron version: unknown',
        'Windows version: unknown',
        'Log folder: unknown',
        'Outputs: unknown',
        'MIDI ports: unknown',
        'MIDI Input: unknown',
        'Tempo: unknown',
        '',
      ].join('\n'),
    );
  });

  it('says none when there are no Outputs, ports or selected MIDI Input', () => {
    const text = diagnosticsText({
      ...FULL,
      outputs: [],
      midiInput: { ports: [], state: 'none' },
    });
    expect(text).toContain('Outputs: none\n');
    expect(text).toContain('MIDI ports: none\n');
    expect(text).toContain('MIDI Input: none\n');
  });

  it('names each Tempo source', () => {
    const tempo = (source: 'default' | 'clock' | 'held' | 'tap') =>
      diagnosticsText({ ...FULL, tempo: { bpm: 120, source } }).match(/^Tempo: .*$/m)?.[0];
    expect(tempo('default')).toBe('Tempo: 120 BPM, default');
    expect(tempo('clock')).toBe('Tempo: 120 BPM from MIDI Clock');
    expect(tempo('held')).toBe('Tempo: 120 BPM held, MIDI Clock lost');
    expect(tempo('tap')).toBe('Tempo: 120 BPM from Tap Tempo');
  });

  it('shows a lost or failed MIDI Input with its error', () => {
    const text = diagnosticsText({
      ...FULL,
      midiInput: { ports: [], selected: 'Launchpad', state: 'failed', error: 'Port busy' },
    });
    expect(text).toContain('MIDI Input: Launchpad (failed: Port busy)\n');
  });

  it('holds no file path except the log folder', () => {
    const paths = diagnosticsText(FULL).match(/[A-Za-z]:\\\S*|\/\S+\//g);
    expect(paths).toEqual([LOG_FOLDER]);
  });
});
