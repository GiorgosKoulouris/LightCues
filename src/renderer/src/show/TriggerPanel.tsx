import { useEffect, useState } from 'react';
import type { MidiInputStatus } from '../../../shared/protocol';
import {
  findTrigger,
  TRIGGER_MODES,
  type MidiNote,
  type Show,
  type Trigger,
  type TriggerMode,
} from '../../../shared/show';
import { midiWarning } from './useMidiInput';

const MODE_LABELS: Record<TriggerMode, string> = {
  go: 'Go',
  flash: 'Flash',
  release: 'Release',
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Selects the MIDI input and maps notes to Scenes. Learn fills the channel
// and note from the next note played.
export function TriggerPanel({
  show,
  status,
  onPut,
  onRemove,
}: {
  show: Show;
  status: MidiInputStatus | undefined;
  onPut(trigger: Trigger): void;
  onRemove(note: MidiNote): void;
}) {
  const sceneName = (id: string) => show.scenes.find((s) => s.id === id)?.name ?? id;
  const triggers = [...show.triggers].sort((a, b) => a.channel - b.channel || a.note - b.note);

  return (
    <section>
      <h3>MIDI Triggers</h3>
      <MidiInputPicker status={status} />
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Note</th>
            <th>Scene</th>
            <th>Mode</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {triggers.map((trigger) => (
            <tr key={`${trigger.channel}/${trigger.note}`}>
              <td>{trigger.channel}</td>
              <td>{noteName(trigger.note)}</td>
              <td>{sceneName(trigger.scene)}</td>
              <td>
                <ModeSelect mode={trigger.mode} onChange={(mode) => onPut({ ...trigger, mode })} />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => onRemove({ channel: trigger.channel, note: trigger.note })}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <NewTrigger show={show} sceneName={sceneName} onPut={onPut} />
    </section>
  );
}

function MidiInputPicker({ status }: { status: MidiInputStatus | undefined }) {
  if (!status) return <p>MIDI input: waiting for engine…</p>;
  const { ports, selected } = status;
  // A lost port is not listed, but stays selected.
  const names = selected === undefined || ports.includes(selected) ? ports : [...ports, selected];
  const warning = midiWarning(status);
  return (
    <p>
      <label>
        MIDI input{' '}
        <select
          value={selected ?? ''}
          onChange={(e) =>
            window.engine.send({ type: 'selectMidiInput', name: e.target.value || undefined })
          }
        >
          <option value="">None</option>
          {names.map((name) => (
            <option key={name} value={name}>
              {ports.includes(name) ? name : `${name} (not found)`}
            </option>
          ))}
        </select>
      </label>{' '}
      {warning ? (
        <strong role="alert">{warning}</strong>
      ) : (
        status.state === 'connected' && 'Listening.'
      )}
    </p>
  );
}

// Maps a channel and note, typed in or learned, to a Scene.
function NewTrigger({
  show,
  sceneName,
  onPut,
}: {
  show: Show;
  sceneName(id: string): string;
  onPut(trigger: Trigger): void;
}) {
  const [channel, setChannel] = useState(1);
  const [note, setNote] = useState(60);
  const [scene, setScene] = useState('');
  const [mode, setMode] = useState<TriggerMode>('go');
  const [learning, setLearning] = useState(false);

  useEffect(() => {
    if (!learning) return;
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'triggerLearned') return;
      setChannel(event.note.channel);
      setNote(event.note.note);
      setLearning(false);
    });
    window.engine.send({ type: 'learnTrigger' });
    return () => {
      unsubscribe();
      window.engine.send({ type: 'cancelLearn' });
    };
  }, [learning]);

  const mapped = findTrigger(show, { channel, note });
  const sceneId = scene || show.scenes[0]?.id;

  return (
    <p>
      <label>
        Channel{' '}
        <input
          type="number"
          min={1}
          max={16}
          value={channel}
          onChange={(e) => setChannel(e.target.valueAsNumber)}
        />
      </label>{' '}
      <label>
        Note{' '}
        <input
          type="number"
          min={0}
          max={127}
          value={note}
          onChange={(e) => setNote(e.target.valueAsNumber)}
        />
      </label>{' '}
      {noteName(note)}{' '}
      <button type="button" aria-pressed={learning} onClick={() => setLearning(!learning)}>
        {learning ? 'Cancel learn' : 'Learn'}
      </button>
      {learning && ' Play a note…'}{' '}
      <label>
        Scene{' '}
        <select value={sceneId ?? ''} onChange={(e) => setScene(e.target.value)}>
          {show.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>{' '}
      <ModeSelect mode={mode} onChange={setMode} />{' '}
      <button
        type="button"
        disabled={sceneId === undefined}
        onClick={() => {
          if (sceneId !== undefined) onPut({ channel, note, scene: sceneId, mode });
        }}
      >
        Map
      </button>
      {mapped && ` Replaces the Trigger for ${sceneName(mapped.scene)}.`}
    </p>
  );
}

function ModeSelect({ mode, onChange }: { mode: TriggerMode; onChange(mode: TriggerMode): void }) {
  return (
    <select
      aria-label="Trigger mode"
      value={mode}
      onChange={(e) => onChange(e.target.value as TriggerMode)}
    >
      {TRIGGER_MODES.map((m) => (
        <option key={m} value={m}>
          {MODE_LABELS[m]}
        </option>
      ))}
    </select>
  );
}

// Note 60 is C4.
function noteName(note: number): string {
  if (!Number.isInteger(note) || note < 0 || note > 127) return '';
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}
