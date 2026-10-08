import {
  EFFECT_LENGTHS,
  EFFECT_SHAPES,
  EFFECT_SIZES,
  isEffectSize,
  MAX_EFFECT_SIZE,
  SPREADS,
  type EffectShape,
  type MovementEffect,
  type Spread,
} from '../../../shared/show';
import { Button } from '../ui/Button';
import { parseNumber, TextField } from '../ui/fields';
import { Select } from '../ui/Select';
import styles from './EffectPicker.module.css';

// A new movement Effect's settings, besides its shape.
const NEW_EFFECT = { size: EFFECT_SIZES.Medium, length: 4, spread: 'In sync' } as const;

// Picks a Rule's movement Effect, or none. A new shape keeps the other
// settings.
export function EffectPicker({
  effect,
  onChange,
}: {
  effect?: MovementEffect;
  onChange(effect: MovementEffect | undefined): void;
}) {
  return (
    <div className={styles.picker}>
      <Select<EffectShape | ''>
        label="Movement Effect"
        value={effect?.shape ?? ''}
        options={[
          { value: '', label: 'Not set' },
          ...EFFECT_SHAPES.map((shape) => ({ value: shape, label: shape })),
        ]}
        onChange={(shape) => onChange(shape ? { ...NEW_EFFECT, ...effect, shape } : undefined)}
      />
      {effect && (
        <>
          <div className={styles.size}>
            <TextField
              label="Size (°)"
              hint="How far from the aim it moves, in degrees."
              mono
              inputMode="decimal"
              value={effect.size}
              parse={parseSize}
              onCommit={(size) => onChange({ ...effect, size })}
            />
            <div role="group" aria-label="Quick sizes" className={styles.quickPicks}>
              {Object.entries(EFFECT_SIZES).map(([name, size]) => (
                <Button
                  key={name}
                  aria-pressed={effect.size === size}
                  onClick={() => onChange({ ...effect, size })}
                >
                  {name} {size}°
                </Button>
              ))}
            </div>
          </div>
          <Select
            label="Length (beats)"
            value={String(effect.length)}
            options={EFFECT_LENGTHS.map((length) => ({
              value: String(length),
              label: String(length),
            }))}
            onChange={(text) => {
              const length = EFFECT_LENGTHS.find((l) => String(l) === text);
              if (length) onChange({ ...effect, length });
            }}
          />
          <Select<Spread>
            label="Spread"
            value={effect.spread}
            options={SPREADS.map((spread) => ({ value: spread, label: spread }))}
            onChange={(spread) => onChange({ ...effect, spread })}
          />
        </>
      )}
    </div>
  );
}

function parseSize(text: string) {
  const result = parseNumber(text, { integer: false });
  if (result.ok && !isEffectSize(result.value)) {
    return { ok: false as const, error: `Must be over 0 and at most ${MAX_EFFECT_SIZE}` };
  }
  return result;
}
