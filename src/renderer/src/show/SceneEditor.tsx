import { Play, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { ROLES, type Role } from '../../../shared/fixture-profile';
import { DIRECTIONS, type Direction, type Rule, type Scene, type Show } from '../../../shared/show';
import type { VenuePatch } from '../../../shared/venue-patch';
import { Button, IconButton } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { NumberField, parseName, TextField } from '../ui/fields';
import { Select } from '../ui/Select';
import { useToast } from '../ui/Toast';
import { moveItem, SortableList, useItemKeys } from '../ui/SortableList';
import { ColourPicker } from './ColourPicker';
import { EffectPicker } from './EffectPicker';
import styles from './SceneEditor.module.css';
import { parseTags } from './scenes';
import { ZonePicker } from './ZonePicker';

// Arrow Up/Down step of the fade-in, in seconds.
const FADE_STEP = 0.5;

interface SceneEditorProps {
  scene: Scene;
  show: Show;
  patch: VenuePatch;
  // Every change is sent at once, so an active Scene updates live. Resolves
  // to whether it was done.
  onPut(scene: Scene): Promise<boolean>;
  onGo(): void;
  onRemove(): void;
}

// Edits one Scene: name, tags, Layer and fade-in in a header, and its Rules as
// cards, reordered by dragging their handle.
export function SceneEditor({ scene, show, patch, onPut, onGo, onRemove }: SceneEditorProps) {
  const toast = useToast();
  // Rules have no ids; these keep focus with a Rule as it moves.
  const ruleKeys = useItemKeys(scene.rules.length);
  const putRules = (rules: Rule[]) => onPut({ ...scene, rules });

  // At once: Undo brings it back.
  async function removeRule(index: number) {
    ruleKeys.remove(index);
    if (!(await putRules(scene.rules.filter((_, i) => i !== index)))) return;
    toast({ message: `Removed Rule ${index + 1} from ${scene.name}` });
  }

  return (
    <section aria-label="Scene editor" className={styles.editor}>
      <header className={styles.header}>
        <TextField
          label="Name"
          value={scene.name}
          parse={parseName}
          onCommit={(name) => onPut({ ...scene, name })}
        />
        <TextField
          label="Tags"
          placeholder="verse, chorus"
          value={scene.tags}
          format={(tags) => tags.join(', ')}
          parse={(text) => ({ ok: true, value: parseTags(text) })}
          equals={sameTags}
          onCommit={(tags) => onPut({ ...scene, tags })}
        />
        <Select
          label="Layer"
          value={scene.layer}
          options={show.layers.map((layer) => ({ value: layer.id, label: layer.name }))}
          onChange={(layer) => onPut({ ...scene, layer })}
        />
        <NumberField
          label="Fade-in (s)"
          value={scene.fadeIn}
          min={0}
          integer={false}
          step={FADE_STEP}
          onCommit={(fadeIn) => onPut({ ...scene, fadeIn })}
        />
        <div className={styles.actions}>
          <Button variant="primary" icon={<Play />} onClick={onGo}>
            Go
          </Button>
          <IconButton icon={<Trash2 />} label="Remove Scene" onClick={onRemove} />
        </div>
      </header>
      <div className={styles.rulesBar}>
        <h3 className={styles.heading}>Rules</h3>
        <span className={styles.hint}>Later Rules override earlier ones.</span>
        <Button
          icon={<Plus />}
          className={styles.addRule}
          onClick={() => putRules([...scene.rules, { target: {}, intensity: 1 }])}
        >
          Add Rule
        </Button>
      </div>
      <div className={styles.rules}>
        {scene.rules.length === 0 ? (
          <p className={styles.empty}>No Rules: this Scene changes nothing.</p>
        ) : (
          <SortableList
            label="Rules"
            items={scene.rules}
            getKey={(_, i) => ruleKeys.keys[i]!}
            itemLabel={(_, i) => `Rule ${i + 1}`}
            onMove={(from, to) => {
              ruleKeys.move(from, to);
              putRules(moveItem(scene.rules, from, to));
            }}
            itemClassName={styles.card}
            renderItem={(rule, i, handle) => (
              <RuleCard
                number={i + 1}
                handle={handle}
                rule={rule}
                patch={patch}
                onPut={(next) => putRules(scene.rules.map((r, j) => (j === i ? next : r)))}
                onRemove={() => void removeRule(i)}
              />
            )}
          />
        )}
      </div>
    </section>
  );
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

function RuleCard({
  number,
  handle,
  rule,
  patch,
  onPut,
  onRemove,
}: {
  number: number;
  handle: ReactNode;
  rule: Rule;
  patch: VenuePatch;
  onPut(rule: Rule): void;
  onRemove(): void;
}) {
  const { target, intensity, colour, direction, effect } = rule;

  // `undefined` leaves the attribute to earlier Rules.
  function set<K extends Exclude<keyof Rule, 'target'>>(key: K, value: Rule[K] | undefined) {
    const next = { ...rule, [key]: value };
    if (value === undefined) delete next[key];
    onPut(next);
  }

  function setTarget(key: 'zones' | 'roles', value: unknown[] | undefined) {
    const next = { ...target, [key]: value };
    if (value === undefined) delete next[key];
    onPut({ ...rule, target: next });
  }

  return (
    <>
      <div className={styles.cardHeader}>
        {handle}
        <h4 className={styles.cardTitle}>Rule {number}</h4>
        <IconButton icon={<Trash2 />} label={`Remove Rule ${number}`} onClick={onRemove} />
      </div>
      <div className={styles.cardBody}>
        <ZonePicker patch={patch} zones={target.zones} onChange={(z) => setTarget('zones', z)} />
        <div className={styles.settings}>
          <RolePicker roles={target.roles} onChange={(r) => setTarget('roles', r)} />
          <div className={styles.intensity}>
            <Checkbox
              label="Intensity"
              checked={intensity !== undefined}
              onChange={(on) => set('intensity', on ? 1 : undefined)}
            />
            {intensity !== undefined && (
              <>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(intensity * 100)}
                  aria-label={`Rule ${number} intensity`}
                  className={styles.slider}
                  onChange={(e) => set('intensity', Number(e.target.value) / 100)}
                />
                <output className={styles.percent}>{Math.round(intensity * 100)}%</output>
              </>
            )}
          </div>
          <ColourPicker colour={colour} onChange={(c) => set('colour', c)} />
          <Select<Direction | ''>
            label="Direction"
            value={direction ?? ''}
            options={[
              { value: '', label: 'Not set' },
              ...DIRECTIONS.map((d) => ({ value: d, label: d })),
            ]}
            onChange={(d) => set('direction', d || undefined)}
          />
          <EffectPicker effect={effect} onChange={(e) => set('effect', e)} />
        </div>
      </div>
    </>
  );
}

// Clicking a Role while every Role is targeted targets it alone. The last
// Role cannot be unticked; choose Every Role instead.
function RolePicker({
  roles,
  onChange,
}: {
  roles?: Role[];
  onChange(roles: Role[] | undefined): void;
}) {
  function toggle(role: Role) {
    if (!roles) return onChange([role]);
    if (!roles.includes(role))
      return onChange(ROLES.filter((r) => r === role || roles.includes(r)));
    const rest = roles.filter((r) => r !== role);
    if (rest.length > 0) onChange(rest);
  }

  return (
    <fieldset className={styles.roles}>
      <legend className={styles.legend}>
        Roles{' '}
        {roles ? (
          <button type="button" className={styles.link} onClick={() => onChange(undefined)}>
            Every Role
          </button>
        ) : (
          <span className={styles.hint}>every Role; click one to target it alone</span>
        )}
      </legend>
      {ROLES.map((role) => (
        <Checkbox
          key={role}
          label={role}
          checked={!roles || roles.includes(role)}
          onChange={() => toggle(role)}
        />
      ))}
    </fieldset>
  );
}
