import { Plus, Radio, Trash2 } from 'lucide-react';
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
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { NumberField } from '../ui/fields';
import { Select } from '../ui/Select';
import { useToast } from '../ui/Toast';
import styles from './TriggerPanel.module.css';
import { sceneName } from './scenes';
import { midiWarning } from './useMidiInput';

const MODE_LABELS: Record<TriggerMode, string> = {
  go: 'Go',
  flash: 'Flash',
  release: 'Release',
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Selects the MIDI Input and maps notes to Scenes. Learn fills the channel
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
  // Resolves to whether it was removed.
  onRemove(note: MidiNote): Promise<boolean>;
}) {
  const toast = useToast();
  const nameOf = (id: string) => sceneName(show, id);
  const triggers = [...show.triggers].sort((a, b) => a.channel - b.channel || a.note - b.note);

  async function remove(trigger: Trigger) {
    if (!(await onRemove({ channel: trigger.channel, note: trigger.note }))) return;
    toast({
      message: `Removed the Trigger on ${noteLabel(trigger)} to ${nameOf(trigger.scene)}`,
    });
  }

  return (
    <div className={styles.panel}>
      <MidiInputPicker status={status} />
      <NewTrigger show={show} sceneName={nameOf} onPut={onPut} />
      {triggers.length === 0 ? (
        <p className={styles.empty}>No Triggers yet: map a note above.</p>
      ) : (
        <table aria-label="Triggers" className={styles.table}>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Note</th>
              <th>Scene</th>
              <th>Mode</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((trigger) => (
              <tr key={`${trigger.channel}/${trigger.note}`}>
                <td className={styles.mono}>{trigger.channel}</td>
                <td className={styles.mono}>
                  {noteName(trigger.note)} <span className={styles.faint}>{trigger.note}</span>
                </td>
                <td>{nameOf(trigger.scene)}</td>
                <td>
                  <ModeSelect
                    label={`Mode for ${noteLabel(trigger)}`}
                    hideLabel
                    mode={trigger.mode}
                    onChange={(mode) => onPut({ ...trigger, mode })}
                  />
                </td>
                <td className={styles.actions}>
                  <IconButton
                    icon={<Trash2 />}
                    label={`Remove the Trigger on ${noteLabel(trigger)}`}
                    onClick={() => void remove(trigger)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MidiInputPicker({ status }: { status: MidiInputStatus | undefined }) {
  if (!status) return <p className={styles.faint}>MIDI Input: waiting for the engine…</p>;
  const { ports, selected } = status;
  // A lost port is not listed, but stays selected.
  const names = selected === undefined || ports.includes(selected) ? ports : [...ports, selected];
  const warning = midiWarning(status);
  return (
    <div className={styles.input}>
      <Select
        label="MIDI Input"
        value={selected ?? ''}
        options={[
          { value: '', label: 'None' },
          ...names.map((name) => ({
            value: name,
            label: ports.includes(name) ? name : `${name} (not found)`,
          })),
        ]}
        onChange={(name) =>
          window.engine.send({ type: 'selectMidiInput', name: name || undefined })
        }
      />
      {warning ? (
        <span className={styles.warning}>{warning}</span>
      ) : (
        status.state === 'connected' && <Badge tone="active">Listening</Badge>
      )}
    </div>
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
  const sceneId = show.scenes.some((s) => s.id === scene) ? scene : show.scenes[0]?.id;

  return (
    <section aria-label="New Trigger" className={styles.form}>
      <NumberField label="Channel" value={channel} min={1} max={16} onCommit={setChannel} />
      <NumberField
        label="Note"
        value={note}
        min={0}
        max={127}
        hint={noteName(note)}
        onCommit={setNote}
      />
      <Button
        icon={<Radio />}
        aria-pressed={learning}
        className={styles.learn}
        onClick={() => setLearning(!learning)}
      >
        {learning ? 'Play a note…' : 'Learn'}
      </Button>
      <Select
        label="Scene"
        value={sceneId ?? ''}
        disabled={sceneId === undefined}
        options={show.scenes.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setScene}
      />
      <ModeSelect label="Mode" mode={mode} onChange={setMode} />
      <Button
        variant="primary"
        icon={<Plus />}
        className={styles.map}
        disabled={sceneId === undefined}
        onClick={() => {
          if (sceneId !== undefined) onPut({ channel, note, scene: sceneId, mode });
        }}
      >
        Map
      </Button>
      {mapped && (
        <span className={styles.replaces}>Replaces the Trigger for {sceneName(mapped.scene)}.</span>
      )}
    </section>
  );
}

function ModeSelect({
  label,
  hideLabel,
  mode,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  mode: TriggerMode;
  onChange(mode: TriggerMode): void;
}) {
  return (
    <Select
      label={label}
      hideLabel={hideLabel}
      value={mode}
      options={TRIGGER_MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
      onChange={onChange}
    />
  );
}

// A note and its channel, as named in labels: "C4 on channel 1".
function noteLabel({ channel, note }: MidiNote): string {
  return `${noteName(note)} on channel ${channel}`;
}

// Note 60 is C4.
function noteName(note: number): string {
  if (!Number.isInteger(note) || note < 0 || note > 127) return '';
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}
