import { useState } from 'react';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { PatchedFixture, VenuePatch } from '../../../shared/venue-patch';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { InlineInput, parseName, parseNumber, useInlineEdit } from '../ui/fields';
import { Select } from '../ui/Select';
import styles from './AddFixtureDialog.module.css';
import { modeOptions, nextAddress, parseAddress, universeOptions } from './fixtures';

interface AddFixtureDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  patch: VenuePatch;
  // The Profile Library's Profiles.
  profiles: FixtureProfile[];
  // Resolves to whether the Fixture was added; the dialog stays open if not.
  onAdd(fixture: PatchedFixture): Promise<boolean>;
}

// Patches a new Fixture: Profile, mode, Universe, name and address. The
// address starts after the Universe's last Fixture.
export function AddFixtureDialog({ open, onOpenChange, ...rest }: AddFixtureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add Fixture">
      {/* Mounted while open, so each opening starts afresh. */}
      {open && <AddFixtureForm {...rest} onCancel={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function AddFixtureForm({
  patch,
  profiles,
  onAdd,
  onCancel,
}: Omit<AddFixtureDialogProps, 'open' | 'onOpenChange'> & { onCancel(): void }) {
  // Profiles the patch embeds come first: adding one of them keeps the
  // patch's copy.
  const choices = [
    ...patch.profiles,
    ...profiles.filter((p) => !patch.profiles.some((e) => e.id === p.id)),
  ];
  const [id] = useState(() => crypto.randomUUID());
  const [profileId, setProfileId] = useState(choices[0]?.id);
  const [modeName, setModeName] = useState<string>();
  const [universe, setUniverse] = useState(patch.universes[0]?.number);
  // What the user typed; until then, the suggested name and address.
  const [typedName, setTypedName] = useState<string>();
  const [typedAddress, setTypedAddress] = useState<number>();
  const profile = choices.find((p) => p.id === profileId) ?? choices[0];
  const mode = profile?.modes.find((m) => m.name === modeName) ?? profile?.modes[0];
  // The patch as it would be with the Profile embedded, to check the address.
  const withProfile: VenuePatch =
    profile && !patch.profiles.includes(profile)
      ? { ...patch, profiles: [...patch.profiles, profile] }
      : patch;

  // The new Fixture but for its name and address.
  const base: PatchedFixture | undefined =
    profile && mode && universe !== undefined
      ? {
          id,
          name: '',
          profileId: profile.id,
          mode: mode.name,
          universe,
          address: 1,
          x: 0,
          y: patch.stage.depth / 6,
          height: 0,
        }
      : undefined;

  const count = patch.fixtures.filter((f) => f.profileId === profile?.id).length;
  const name = useInlineEdit({
    value: typedName ?? (profile ? `${profile.model} ${count + 1}` : ''),
    format: String,
    parse: parseName,
    onCommit: setTypedName,
  });
  const address = useInlineEdit({
    value: typedAddress ?? (universe === undefined ? 1 : nextAddress(patch, universe)),
    format: String,
    parse: (text) => (base ? parseAddress(withProfile, base, text) : parseNumber(text)),
    onCommit: setTypedAddress,
  });

  if (!profile || !mode) {
    return (
      <p className={styles.message}>Add a Profile to the Profile Library to patch Fixtures.</p>
    );
  }
  if (!base) {
    return <p className={styles.message}>Add a Universe in Rig setup to patch Fixtures.</p>;
  }
  const fixture =
    name.parsed !== undefined && address.parsed !== undefined
      ? { ...base, name: name.parsed, address: address.parsed }
      : undefined;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (fixture) void onAdd(fixture).then((added) => added && onCancel());
      }}
    >
      <Select
        label="Profile"
        value={base.profileId}
        options={choices.map((p) => ({ value: p.id, label: `${p.manufacturer} ${p.model}` }))}
        onChange={setProfileId}
      />
      <Select
        label="Mode"
        value={base.mode}
        options={modeOptions(profile)}
        onChange={setModeName}
      />
      <InlineInput label="Name" edit={name} />
      <div className={styles.row}>
        <Select
          label="Universe"
          value={String(universe)}
          options={universeOptions(patch)}
          onChange={(value) => {
            setUniverse(Number(value));
            setTypedAddress(undefined);
          }}
        />
        <InlineInput label="Address" mono edit={address} />
      </div>
      <footer className={styles.footer}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!fixture}>
          Add
        </Button>
      </footer>
    </form>
  );
}
