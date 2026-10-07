import { SWATCHES, type Colour, type Swatch } from '../../../shared/show';

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
  const kind = colour === undefined ? 'none' : 'swatch' in colour ? 'swatch' : 'hue';
  return (
    <p>
      <label>
        {label}{' '}
        <select
          value={kind}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'none') onChange(undefined);
            else if (value === 'swatch') onChange({ swatch: 'White' });
            else onChange({ hue: 0, saturation: 1 });
          }}
        >
          <option value="none">{unset}</option>
          <option value="swatch">Swatch</option>
          <option value="hue">Hue and saturation</option>
        </select>
      </label>{' '}
      {colour && 'swatch' in colour && (
        <select
          value={colour.swatch}
          aria-label="Swatch"
          onChange={(e) => onChange({ swatch: e.target.value as Swatch })}
        >
          {SWATCHES.map((swatch) => (
            <option key={swatch}>{swatch}</option>
          ))}
        </select>
      )}
      {colour && 'hue' in colour && (
        <>
          <label>
            Hue{' '}
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(colour.hue)}
              onChange={(e) => onChange({ ...colour, hue: Number(e.target.value) })}
            />
          </label>{' '}
          <label>
            Saturation{' '}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(colour.saturation * 100)}
              onChange={(e) => onChange({ ...colour, saturation: Number(e.target.value) / 100 })}
            />
          </label>{' '}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '1.5em',
              height: '1em',
              verticalAlign: 'middle',
              background: `hsl(${colour.hue} ${colour.saturation * 100}% 50%)`,
            }}
          />
        </>
      )}
    </p>
  );
}
