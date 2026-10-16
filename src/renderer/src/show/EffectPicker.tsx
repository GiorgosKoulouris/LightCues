import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  beatsLabel,
  COLOUR_SHAPES,
  EFFECT_LENGTHS,
  EFFECT_SHAPES,
  EFFECT_SIZES,
  INTENSITY_SHAPES,
  isEffectSize,
  MAX_EFFECT_COLOURS,
  MAX_EFFECT_SIZE,
  MIN_EFFECT_COLOURS,
  NO_EFFECT,
  SPREADS,
  type Colour,
  type ColourEffect,
  type ColourShape,
  type EffectLength,
  type EffectSlot,
  type IntensityEffect,
  type MovementEffect,
  type Spread,
} from '../../../shared/show';
import { Button, IconButton } from '../ui/Button';
import { parseNumber, TextField } from '../ui/fields';
import { Select } from '../ui/Select';
import { ColourPicker } from './ColourPicker';
import styles from './EffectPicker.module.css';

// A new movement Effect's settings, besides its shape.
const NEW_EFFECT = { size: EFFECT_SIZES.Medium, length: 4, spread: 'In sync' } as const;

// A new intensity Effect's settings, besides its shape.
const NEW_INTENSITY_EFFECT = { depth: 1, length: 1, spread: 'In sync' } as const;

// A new colour Effect's length and Spread, and a new Step or Fade's colours.
const NEW_COLOUR_EFFECT = { length: 2, spread: 'In sync' } as const;
const NEW_COLOURS: Colour[] = [{ swatch: 'Red' }, { swatch: 'Blue' }];

// The colour added to a Step or Fade.
const ADDED_COLOUR: Colour = { swatch: 'White' };

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
      <ShapeSelect
        label="Movement Effect"
        shapes={EFFECT_SHAPES}
        slot={slot}
        onChange={(choice) => onChange(slotFor(choice, NEW_EFFECT, effect))}
      />
      {effect && (
        <Settings<MovementEffect> label="Movement Effect" effect={effect} onChange={onChange}>
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
        </Settings>
      )}
    </div>
  );
}

// Picks a Rule's intensity Effect, None, or leaves it to others. A new shape
// keeps the other settings.
export function IntensityEffectPicker({
  slot,
  onChange,
}: {
  slot?: EffectSlot<IntensityEffect>;
  onChange(slot: EffectSlot<IntensityEffect> | undefined): void;
}) {
  const effect = slot === NO_EFFECT ? undefined : slot;
  return (
    <div className={styles.picker}>
      <ShapeSelect
        label="Intensity Effect"
        shapes={INTENSITY_SHAPES}
        slot={slot}
        onChange={(choice) => onChange(slotFor(choice, NEW_INTENSITY_EFFECT, effect))}
      />
      {effect && (
        <Settings<IntensityEffect> label="Intensity Effect" effect={effect} onChange={onChange}>
          <TextField
            label="Depth (%)"
            hint="How far it dips: to dark at 100%, to half at 50%."
            mono
            inputMode="decimal"
            value={Math.round(effect.depth * 100)}
            parse={parseDepth}
            onCommit={(depth) => onChange({ ...effect, depth: depth / 100 })}
          />
        </Settings>
      )}
    </div>
  );
}

// Picks a Rule's colour Effect, None, or leaves it to others. A new shape
// keeps the other settings; a Rainbow drops the colours.
export function ColourEffectPicker({
  slot,
  onChange,
}: {
  slot?: EffectSlot<ColourEffect>;
  onChange(slot: EffectSlot<ColourEffect> | undefined): void;
}) {
  const effect = slot === NO_EFFECT ? undefined : slot;
  return (
    <div className={styles.picker}>
      <ShapeSelect
        label="Colour Effect"
        shapes={COLOUR_SHAPES}
        slot={slot}
        onChange={(choice) => onChange(colourSlotFor(choice, effect))}
      />
      {effect && (
        <Settings<ColourEffect> label="Colour Effect" effect={effect} onChange={onChange}>
          {effect.shape !== 'Rainbow' && (
            <ColourList
              colours={effect.colours}
              onChange={(colours) => onChange({ ...effect, colours })}
            />
          )}
        </Settings>
      )}
    </div>
  );
}

// A Step or Fade's colours, 2 to 4.
function ColourList({
  colours,
  onChange,
}: {
  colours: Colour[];
  onChange(colours: Colour[]): void;
}) {
  return (
    <div className={styles.colours}>
      {colours.map((colour, i) => (
        <div key={i} className={styles.colour}>
          <ColourPicker
            label={`Colour ${i + 1}`}
            unset={null}
            colour={colour}
            onChange={(next) => {
              if (next) onChange(colours.map((c, j) => (j === i ? next : c)));
            }}
          />
          {colours.length > MIN_EFFECT_COLOURS && (
            <IconButton
              icon={<X />}
              label={`Remove Colour ${i + 1}`}
              onClick={() => onChange(colours.filter((_, j) => j !== i))}
            />
          )}
        </div>
      ))}
      {colours.length < MAX_EFFECT_COLOURS && (
        <Button icon={<Plus />} onClick={() => onChange([...colours, ADDED_COLOUR])}>
          Add colour
        </Button>
      )}
    </div>
  );
}

// The colour Effect slot a picked option sets, keeping the length, Spread
// and colours of `effect`.
function colourSlotFor(
  choice: ColourShape | typeof NO_EFFECT | '',
  effect: ColourEffect | undefined,
): EffectSlot<ColourEffect> | undefined {
  if (choice === '') return undefined;
  if (choice === NO_EFFECT) return NO_EFFECT;
  const { length, spread } = effect ?? NEW_COLOUR_EFFECT;
  if (choice === 'Rainbow') return { shape: choice, length, spread };
  const colours = effect?.shape === 'Rainbow' ? NEW_COLOURS : (effect?.colours ?? NEW_COLOURS);
  return { shape: choice, colours, length, spread };
}

// An Effect slot's shape, None, or Not set.
function ShapeSelect<S extends string>({
  label,
  shapes,
  slot,
  onChange,
}: {
  label: string;
  shapes: readonly S[];
  slot: EffectSlot<{ shape: S }> | undefined;
  onChange(choice: S | typeof NO_EFFECT | ''): void;
}) {
  return (
    <Select<S | typeof NO_EFFECT | ''>
      label={label}
      value={slot === NO_EFFECT ? NO_EFFECT : (slot?.shape ?? '')}
      options={[
        { value: '', label: 'Not set' },
        { value: NO_EFFECT, label: 'None' },
        ...shapes.map((shape) => ({ value: shape, label: shape })),
      ]}
      onChange={onChange}
    />
  );
}

// An Effect's settings: those of its kind, then its length and Spread.
function Settings<E extends { length: EffectLength; spread: Spread }>({
  label,
  effect,
  onChange,
  children,
}: {
  label: string;
  effect: E;
  onChange(effect: E): void;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={`${label} settings`} className={styles.picker}>
      {children}
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
    </div>
  );
}

// The slot a picked option sets: unset, None, or an Effect of that shape,
// keeping the settings of `effect`, or else taking `fresh`.
function slotFor<S extends string, E extends { shape: S }>(
  choice: S | typeof NO_EFFECT | '',
  fresh: Omit<E, 'shape'>,
  effect: E | undefined,
): EffectSlot<E> | undefined {
  if (choice === '') return undefined;
  if (choice === NO_EFFECT) return NO_EFFECT;
  return { ...fresh, ...effect, shape: choice } as E;
}

function parseSize(text: string) {
  const result = parseNumber(text, { integer: false });
  if (result.ok && !isEffectSize(result.value)) {
    return { ok: false as const, error: `Must be over 0 and at most ${MAX_EFFECT_SIZE}` };
  }
  return result;
}

function parseDepth(text: string) {
  const result = parseNumber(text, { integer: false });
  if (result.ok && !(result.value >= 0 && result.value <= 100)) {
    return { ok: false as const, error: 'Must be from 0 to 100' };
  }
  return result;
}
