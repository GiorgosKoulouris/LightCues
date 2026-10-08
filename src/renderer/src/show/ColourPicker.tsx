import { SWATCHES, type Colour, type Swatch } from '../../../shared/show';
import { Select } from '../ui/Select';
import styles from './ColourPicker.module.css';

type Kind = 'none' | 'swatch' | 'hue';

// Picks a swatch or a hue and saturation, or no colour, shown as `unset`.
export function ColourPicker({
  label = 'Colour',
  unset = 'Not set',
  colour,
  onChange,
}: {
  label?: string;
  unset?: string;
  colour?: Colour;
  onChange(colour: Colour | undefined): void;
}) {
  const kind: Kind = colour === undefined ? 'none' : 'swatch' in colour ? 'swatch' : 'hue';
  return (
    <div className={styles.picker}>
      <Select<Kind>
        label={label}
        value={kind}
        options={[
          { value: 'none', label: unset },
          { value: 'swatch', label: 'Swatch' },
          { value: 'hue', label: 'Hue and saturation' },
        ]}
        onChange={(value) => {
          if (value === 'none') onChange(undefined);
          else if (value === 'swatch') onChange({ swatch: 'White' });
          else onChange({ hue: 0, saturation: 1 });
        }}
      />
      {colour && 'swatch' in colour && (
        <Select<Swatch>
          label="Swatch"
          value={colour.swatch}
          options={SWATCHES.map((swatch) => ({ value: swatch, label: swatch }))}
          onChange={(swatch) => onChange({ swatch })}
        />
      )}
      {colour && 'hue' in colour && (
        <div className={styles.hue}>
          <label className={styles.slider}>
            <span className={styles.label}>Hue</span>
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(colour.hue)}
              onChange={(e) => onChange({ ...colour, hue: Number(e.target.value) })}
            />
          </label>
          <label className={styles.slider}>
            <span className={styles.label}>Saturation</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(colour.saturation * 100)}
              onChange={(e) => onChange({ ...colour, saturation: Number(e.target.value) / 100 })}
            />
          </label>
          <span
            aria-hidden
            className={styles.sample}
            style={{ background: `hsl(${colour.hue} ${colour.saturation * 100}% 50%)` }}
          />
        </div>
      )}
    </div>
  );
}
