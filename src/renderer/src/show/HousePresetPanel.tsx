import { Plus, Radio, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import {
  MAX_HOUSE_PRESETS,
  showHousePresets,
  type HousePreset,
  type Show,
} from '../../../shared/show';
import { Button, IconButton } from '../ui/Button';
import { NumberField, parseName, TextField } from '../ui/fields';
import { removedMessage } from '../ui/removed';
import { SortableList } from '../ui/SortableList';
import { useToast } from '../ui/Toast';
import styles from './HousePresetPanel.module.css';
import { freeNote, noteName } from './notes';
import { freeId } from './scenes';
import { useMidiLearn } from './useMidiInput';

// Seconds a new House Preset fades over.
const DEFAULT_FADE = 2;
const FADE_STEP = 0.5;

// The Show's House Presets in order: name, fade and an optional
// MIDI note, typed in or learned. Each Venue Patch gives them their looks.
export function HousePresetPanel({
  show,
  onPut,
  onMove,
  onRemove,
}: {
  show: Show;
  onPut(preset: HousePreset): void;
  onMove(id: string, to: number): void;
  // Resolves to whether it was removed.
  onRemove(id: string): Promise<boolean>;
}) {
  const toast = useToast();
  const headingId = useId();
  const presets = showHousePresets(show);
  // The House Preset whose note the next one played sets.
  const [learningId, setLearningId] = useState<string>();
  const learning = presets.find((p) => p.id === learningId);

  useMidiLearn(learning !== undefined, (note) => {
    if (learning) onPut({ ...learning, note });
    setLearningId(undefined);
  });

  function add() {
    let n = presets.length + 1;
    while (presets.some((p) => p.name === `House Preset ${n}`)) n++;
    onPut({ id: freeId('house', presets), name: `House Preset ${n}`, fade: DEFAULT_FADE });
  }

  async function remove({ id, name }: HousePreset) {
    if (!(await onRemove(id))) return;
    toast({ message: removedMessage(name) });
  }

  return (
    <section aria-labelledby={headingId} className={styles.panel}>
      <div className={styles.bar}>
        <h3 id={headingId} className={styles.heading}>
          House Presets
        </h3>
        <Button icon={<Plus />} disabled={presets.length >= MAX_HOUSE_PRESETS} onClick={add}>
          Add House Preset
        </Button>
      </div>
      <p className={styles.hint}>
        Up to {MAX_HOUSE_PRESETS}, in this order. Drag to reorder. A note does Go only. Each Venue
        Patch sets their looks.
      </p>
      {presets.length === 0 ? (
        <p className={styles.empty}>No House Presets yet: add one for each house look.</p>
      ) : (
        <SortableList
          label="House Presets"
          items={presets}
          getKey={(p) => p.id}
          itemLabel={(p) => p.name}
          onMove={(from, to) => onMove(presets[from]!.id, to)}
          itemClassName={styles.item}
          renderItem={(preset, _, handle) => (
            <>
              {handle}
              <TextField
                label={`Name of ${preset.name}`}
                hideLabel
                value={preset.name}
                parse={parseName}
                onCommit={(name) => onPut({ ...preset, name })}
              />
              <NumberField
                label={`Fade of ${preset.name} (s)`}
                hideLabel
                value={preset.fade}
                min={0}
                integer={false}
                step={FADE_STEP}
                onCommit={(fade) => onPut({ ...preset, fade })}
              />
              <NoteFields
                preset={preset}
                learning={preset.id === learningId}
                onLearn={(on) => setLearningId(on ? preset.id : undefined)}
                onPut={onPut}
                show={show}
              />
              <IconButton
                icon={<Trash2 />}
                label={`Remove House Preset ${preset.name}`}
                onClick={() => void remove(preset)}
              />
            </>
          )}
        />
      )}
    </section>
  );
}

// A House Preset's channel and note, or none; typed in or learned.
function NoteFields({
  show,
  preset,
  learning,
  onLearn,
  onPut,
}: {
  show: Show;
  preset: HousePreset;
  learning: boolean;
  onLearn(on: boolean): void;
  onPut(preset: HousePreset): void;
}) {
  const { name, note, ...rest } = preset;
  const learn = (
    <Button
      variant="ghost"
      icon={<Radio />}
      aria-pressed={learning}
      aria-label={`Learn a note for ${name}`}
      onClick={() => onLearn(!learning)}
    >
      {learning ? 'Play a note…' : 'Learn'}
    </Button>
  );
  if (!note) {
    return (
      <div className={styles.note}>
        <span className={styles.none}>No note</span>
        {learn}
        <IconButton
          icon={<Plus />}
          label={`Add a note to ${name}`}
          onClick={() => onPut({ ...preset, note: freeNote(show) })}
        />
      </div>
    );
  }
  return (
    <div className={styles.note}>
      <NumberField
        label={`Channel of ${name}`}
        hideLabel
        className={styles.channel}
        value={note.channel}
        min={1}
        max={16}
        onCommit={(channel) => onPut({ ...preset, note: { ...note, channel } })}
      />
      <NumberField
        label={`Note of ${name}`}
        hideLabel
        className={styles.noteNumber}
        value={note.note}
        min={0}
        max={127}
        hint={noteName(note.note)}
        onCommit={(n) => onPut({ ...preset, note: { ...note, note: n } })}
      />
      {learn}
      <IconButton
        icon={<X />}
        label={`Clear the note of ${name}`}
        onClick={() => onPut({ name, ...rest })}
      />
    </div>
  );
}
