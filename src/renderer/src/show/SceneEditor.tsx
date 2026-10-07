import { useState } from 'react';
import { ROLES, type Role } from '../../../shared/fixture-profile';
import type { Rule, Scene, Show } from '../../../shared/show';
import type { VenuePatch } from '../../../shared/venue-patch';
import { ColourPicker } from './ColourPicker';
import { ZonePicker } from './ZonePicker';

interface SceneEditorProps {
  scene: Scene;
  show: Show;
  patch: VenuePatch;
  // Every change is sent at once, so an active Scene updates live.
  onPut(scene: Scene): void;
}

// Edits one Scene: name, tags, Layer, fade-in and Rules. Key it by Scene id,
// so its text fields start from the Scene shown.
export function SceneEditor({ scene, show, patch, onPut }: SceneEditorProps) {
  const [name, setName] = useState(scene.name);
  const [tags, setTags] = useState(scene.tags.join(', '));
  const [fadeIn, setFadeIn] = useState(String(scene.fadeIn));

  function putRule(index: number, rule: Rule) {
    onPut({ ...scene, rules: scene.rules.map((r, i) => (i === index ? rule : r)) });
  }

  function moveRule(index: number, by: -1 | 1) {
    const rules = [...scene.rules];
    const [rule] = rules.splice(index, 1);
    rules.splice(index + by, 0, rule!);
    onPut({ ...scene, rules });
  }

  return (
    <section>
      <h3>Scene</h3>
      <p>
        <label>
          Name{' '}
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              onPut({ ...scene, name: e.target.value });
            }}
          />
        </label>{' '}
        <label>
          Tags{' '}
          <input
            value={tags}
            placeholder="verse, chorus"
            onChange={(e) => setTags(e.target.value)}
            onBlur={() => onPut({ ...scene, tags: parseTags(tags) })}
          />
        </label>{' '}
        <label>
          Layer{' '}
          <select value={scene.layer} onChange={(e) => onPut({ ...scene, layer: e.target.value })}>
            {show.layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Fade-in (s){' '}
          <input
            type="number"
            min={0}
            step={0.1}
            value={fadeIn}
            style={{ width: '5em' }}
            onChange={(e) => {
              setFadeIn(e.target.value);
              const seconds = Number(e.target.value);
              if (e.target.value !== '' && seconds >= 0) onPut({ ...scene, fadeIn: seconds });
            }}
          />
        </label>
      </p>
      <h4>Rules</h4>
      <p>Later Rules override earlier ones.</p>
      <ol>
        {scene.rules.map((rule, i) => (
          <li key={i}>
            <RuleEditor rule={rule} patch={patch} onPut={(r) => putRule(i, r)} />
            <p>
              <button type="button" disabled={i === 0} onClick={() => moveRule(i, -1)}>
                Move up
              </button>
              <button
                type="button"
                disabled={i === scene.rules.length - 1}
                onClick={() => moveRule(i, 1)}
              >
                Move down
              </button>
              <button
                type="button"
                onClick={() => onPut({ ...scene, rules: scene.rules.filter((_, j) => j !== i) })}
              >
                Remove Rule
              </button>
            </p>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onPut({ ...scene, rules: [...scene.rules, { target: {}, intensity: 1 }] })}
      >
        Add Rule
      </button>
    </section>
  );
}

// Comma-separated, trimmed, without empty or repeated tags.
function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map((t) => t.trim()))].filter((t) => t !== '');
}

function RuleEditor({
  rule,
  patch,
  onPut,
}: {
  rule: Rule;
  patch: VenuePatch;
  onPut(rule: Rule): void;
}) {
  const { target, intensity, colour } = rule;

  // `undefined` leaves the attribute to earlier Rules.
  function set<K extends 'intensity' | 'colour'>(key: K, value: Rule[K] | undefined) {
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
    <div>
      <ZonePicker patch={patch} zones={target.zones} onChange={(z) => setTarget('zones', z)} />
      <RolePicker roles={target.roles} onChange={(r) => setTarget('roles', r)} />
      <p>
        <label>
          <input
            type="checkbox"
            checked={intensity !== undefined}
            onChange={(e) => set('intensity', e.target.checked ? 1 : undefined)}
          />{' '}
          Intensity
        </label>{' '}
        {intensity !== undefined && (
          <>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(intensity * 100)}
              aria-label="Intensity"
              onChange={(e) => set('intensity', Number(e.target.value) / 100)}
            />{' '}
            {Math.round(intensity * 100)} %
          </>
        )}
      </p>
      <ColourPicker colour={colour} onChange={(c) => set('colour', c)} />
    </div>
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
    <fieldset>
      <legend>Roles</legend>
      {ROLES.map((role) => (
        <label key={role} style={{ marginRight: '1em' }}>
          <input
            type="checkbox"
            checked={!roles || roles.includes(role)}
            onChange={() => toggle(role)}
          />{' '}
          {role}
        </label>
      ))}
      {roles ? (
        <button type="button" onClick={() => onChange(undefined)}>
          Every Role
        </button>
      ) : (
        <span>(every Role; click one to target it alone)</span>
      )}
    </fieldset>
  );
}
