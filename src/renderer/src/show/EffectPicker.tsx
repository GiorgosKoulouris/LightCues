import {
  beatsLabel,
  EFFECT_LENGTHS,
  EFFECT_SHAPES,
  EFFECT_SIZES,
  isEffectSize,
  MAX_EFFECT_SIZE,
  NO_EFFECT,
  SPREADS,
  type EffectShape,
  type EffectSlot,
  type MovementEffect,
  type Spread,
} from '../../../shared/show';
import { Button } from '../ui/Button';
import { parseNumber, TextField } from '../ui/fields';
import { Select } from '../ui/Select';
import styles from './EffectPicker.module.css';

// A new movement Effect's settings, besides its shape.
const NEW_EFFECT = { size: EFFECT_SIZES.Medium, length: 4, spread: 'In sync' } as const;

// Picks a Rule's movement Effect, None, or leaves it to others. A new shape
// keeps the other settings.
export function EffectPicker({
  slot,
  onChange,
}: {
  slot?: EffectSlot<MovementEffect>;
  onChange(slot: EffectSlot<MovementEffect> | undefined): void;
}) {
  const effect = slot === NO_EFFECT ? undefined : slot;
  return (
    <div className={styles.picker}>
      <Select<EffectShape | typeof NO_EFFECT | ''>
        label="Movement Effect"
        value={slot === NO_EFFECT ? NO_EFFECT : (effect?.shape ?? '')}
        options={[
          { value: '', label: 'Not set' },
          { value: NO_EFFECT, label: 'None' },
          ...EFFECT_SHAPES.map((shape) => ({ value: shape, label: shape })),
        ]}
        onChange={(choice) => onChange(slotFor(choice, effect))}
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
              label: beatsLabel(length),
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

// The slot a picked option sets: unset, None, or an Effect of that shape.
function slotFor(
  choice: EffectShape | typeof NO_EFFECT | '',
  effect: MovementEffect | undefined,
): EffectSlot<MovementEffect> | undefined {
  if (choice === '') return undefined;
  if (choice === NO_EFFECT) return NO_EFFECT;
  return { ...NEW_EFFECT, ...effect, shape: choice };
}

function parseSize(text: string) {
  const result = parseNumber(text, { integer: false });
  if (result.ok && !isEffectSize(result.value)) {
    return { ok: false as const, error: `Must be over 0 and at most ${MAX_EFFECT_SIZE}` };
  }
  return result;
}
