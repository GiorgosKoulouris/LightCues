import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import type { VenueEdit } from '../../../shared/protocol';
import {
  FULL_WHITE,
  patchHouse,
  patchProfile,
  putHouseLight,
  type HouseGroup,
  type HouseLight,
  type HouseLook,
  type HouseSetting,
  type VenuePatch,
  withoutGroup,
} from '../../../shared/venue-patch';
import { ColourPicker } from '../show/ColourPicker';
import { Button, IconButton } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { parseName, TextField } from '../ui/fields';
import { namedCount, removedMessage } from '../ui/removed';
import { Select } from '../ui/Select';
import { useToast } from '../ui/Toast';
import { AddFixtureDialog } from './AddFixtureDialog';
import { modeOptions, parseAddress, universeOptions } from './fixtures';
import styles from './HouseSetup.module.css';

interface HouseSetupProps {
  patch: VenuePatch;
  // The Profile Library's Profiles.
  profiles: FixtureProfile[];
  // Resolves to whether the edit was made.
  change(edit: VenueEdit): Promise<boolean>;
}

// The House Groups, their House Lights and the Startup look. Mounted only
// while the House tab shows: once the Startup look is edited, the rig shows
// it live until the tab is left, then goes back to the house state.
export function HouseSetup({ patch, profiles, change }: HouseSetupProps) {
  const toast = useToast();
  const { groups, lights, startupLook } = patchHouse(patch);
  // The House Group a House Light is being added to.
  const [addingTo, setAddingTo] = useState<string>();
  const [edited, setEdited] = useState(false);
  useHouseLookPreview(edited, startupLook);

  async function removeGroup(group: HouseGroup) {
    const its = lights.filter((l) => l.group === group.id);
    if (!(await change({ type: 'removeHouseGroup', id: group.id }))) return;
    const also =
      its.length > 0
        ? [
            `its ${namedCount(
              'House Light',
              its.map((l) => l.name),
            )}`,
          ]
        : [];
    toast({ message: removedMessage(group.name, also) });
  }

  async function removeLight(light: HouseLight) {
    if (await change({ type: 'removeHouseLights', ids: [light.id] })) {
      toast({ message: removedMessage(light.name) });
    }
  }

  function setLook(look: HouseLook) {
    setEdited(true);
    void change({ type: 'setStartupLook', ...(Object.keys(look).length > 0 && { look }) });
  }

  return (
    <div className={styles.house}>
      <section className={styles.section}>
        <h3 className={styles.heading}>House Groups</h3>
        <p className={styles.hint}>
          The venue&apos;s own lights, such as the bar. Scenes, Blackout, the Grand Master, Freeze
          and Blind never reach them.
        </p>
        {groups.map((group) => (
          <HouseGroupCard
            key={group.id}
            patch={patch}
            group={group}
            lights={lights.filter((l) => l.group === group.id)}
            change={change}
            onAddLight={() => setAddingTo(group.id)}
            onRemove={() => void removeGroup(group)}
            onRemoveLight={(light) => void removeLight(light)}
          />
        ))}
        <Button
          icon={<Plus />}
          className={styles.add}
          onClick={() =>
            void change({
              type: 'putHouseGroup',
              group: { id: crypto.randomUUID(), name: `House Group ${groups.length + 1}` },
            })
          }
        >
          Add House Group
        </Button>
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>Startup look</h3>
        <p className={styles.hint}>
          Sent from launch and when this Venue Patch is opened. A Group it does not set starts at
          full white. While you edit it, the rig shows it until you leave this tab.
        </p>
        {groups.length > 0 ? (
          <HouseLookEditor groups={groups} look={startupLook ?? {}} onChange={setLook} />
        ) : (
          <p className={styles.empty}>Add a House Group to set the Startup look.</p>
        )}
      </section>
      <AddFixtureDialog
        title="Add House Light"
        open={addingTo !== undefined}
        onOpenChange={(open) => {
          if (!open) setAddingTo(undefined);
        }}
        patch={patch}
        profiles={profiles}
        onAdd={(fixture) =>
          change({ type: 'putHouseLight', light: { ...fixture, group: addingTo! } })
        }
      />
    </div>
  );
}

// While `on`, the House Lights show `look` over the house state. Once off, or
// unmounted, they go back to the house state.
function useHouseLookPreview(on: boolean, look: HouseLook | undefined) {
  useEffect(() => {
    if (on) window.engine.send({ type: 'previewHouseLook', look: look ?? {} });
  }, [on, look]);
  useEffect(() => {
    if (!on) return;
    return () => window.engine.send({ type: 'previewHouseLook' });
  }, [on]);
}

// A House Group's name and its House Lights.
function HouseGroupCard({
  patch,
  group,
  lights,
  change,
  onAddLight,
  onRemove,
  onRemoveLight,
}: {
  patch: VenuePatch;
  group: HouseGroup;
  lights: HouseLight[];
  change(edit: VenueEdit): Promise<boolean>;
  onAddLight(): void;
  onRemove(): void;
  onRemoveLight(light: HouseLight): void;
}) {
  return (
    <section aria-label={`House Group ${group.name}`} className={styles.group}>
      <div className={styles.groupHeader}>
        <TextField
          label="House Group name"
          hideLabel
          value={group.name}
          parse={parseName}
          onCommit={(name) => void change({ type: 'putHouseGroup', group: { ...group, name } })}
        />
        <IconButton
          icon={<Trash2 />}
          label={`Remove House Group ${group.name}`}
          onClick={onRemove}
        />
      </div>
      {lights.length > 0 ? (
        <table aria-label={`${group.name} House Lights`} className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Profile</th>
              <th>Mode</th>
              <th>Universe</th>
              <th>Address</th>
              <th>House Group</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lights.map((light) => (
              <HouseLightRow
                key={light.id}
                patch={patch}
                light={light}
                onPut={(next) => void change({ type: 'putHouseLight', light: next })}
                onRemove={() => onRemoveLight(light)}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>No House Lights yet.</p>
      )}
      <Button icon={<Plus />} className={styles.add} onClick={onAddLight}>
        Add House Light
      </Button>
    </section>
  );
}

// The select fields whose change can make a House Light not fit. Their
// errors show below them.
type CheckedField = 'mode' | 'universe';

// A House Light's patch fields, as a stage Fixture's without position, Zone,
// Role or Mounting. A choice that does not fit is not sent; its error shows
// inline.
function HouseLightRow({
  patch,
  light,
  onPut,
  onRemove,
}: {
  patch: VenuePatch;
  light: HouseLight;
  onPut(light: HouseLight): void;
  onRemove(): void;
}) {
  const [errors, setErrors] = useState<Partial<Record<CheckedField, string>>>({});
  const profile = patchProfile(patch, light);

  // Checks a change against the patch first, as the engine would.
  function put(next: HouseLight, field?: CheckedField) {
    const result = putHouseLight(patch, next);
    if ('errors' in result && field) {
      setErrors({ [field]: result.errors.join(' ') });
      return;
    }
    setErrors({});
    onPut(next);
  }

  return (
    <tr>
      <td>
        <TextField
          label={`Name of ${light.name}`}
          hideLabel
          value={light.name}
          parse={parseName}
          onCommit={(name) => put({ ...light, name })}
        />
      </td>
      <td className={styles.profile}>
        {profile.manufacturer} {profile.model}
      </td>
      <td>
        <Select
          label={`Mode of ${light.name}`}
          hideLabel
          error={errors.mode}
          value={light.mode}
          options={modeOptions(profile)}
          onChange={(mode) => put({ ...light, mode }, 'mode')}
        />
      </td>
      <td>
        <Select
          label={`Universe of ${light.name}`}
          hideLabel
          error={errors.universe}
          value={String(light.universe)}
          options={universeOptions(patch)}
          onChange={(universe) => put({ ...light, universe: Number(universe) }, 'universe')}
        />
      </td>
      <td>
        <TextField
          label={`Address of ${light.name}`}
          hideLabel
          mono
          className={styles.address}
          value={light.address}
          parse={(text) => parseAddress(patch, light, text)}
          onCommit={(address) => put({ ...light, address })}
        />
      </td>
      <td>
        <Select
          label={`House Group of ${light.name}`}
          hideLabel
          value={light.group}
          options={patchHouse(patch).groups.map((g) => ({ value: g.id, label: g.name }))}
          onChange={(group) => put({ ...light, group })}
        />
      </td>
      <td className={styles.actions}>
        <IconButton icon={<Trash2 />} label={`Remove ${light.name}`} onClick={onRemove} />
      </td>
    </tr>
  );
}

// A house look: per House Group, whether the look sets it, and if so its
// intensity and colour.
function HouseLookEditor({
  groups,
  look,
  onChange,
}: {
  groups: HouseGroup[];
  look: HouseLook;
  onChange(look: HouseLook): void;
}) {
  return (
    <div className={styles.look}>
      {groups.map((group) => {
        const setting = Object.hasOwn(look, group.id) ? look[group.id] : undefined;
        const put = (next: HouseSetting | undefined) =>
          onChange(next ? { ...look, [group.id]: next } : (withoutGroup(look, group.id) ?? {}));
        const percent = setting && Math.round(setting.intensity * 100);
        return (
          <fieldset key={group.id} className={styles.setting}>
            <legend className={styles.legend}>{group.name}</legend>
            <Checkbox
              label="Set in this look"
              checked={setting !== undefined}
              // A Group is set at full white first, as it shows when unset.
              onChange={(on) => put(on ? FULL_WHITE : undefined)}
            />
            {setting && (
              <>
                <div className={styles.intensity}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={percent}
                    aria-label={`${group.name} intensity`}
                    className={styles.slider}
                    onChange={(e) => put({ ...setting, intensity: Number(e.target.value) / 100 })}
                  />
                  <output className={styles.percent}>{percent}%</output>
                </div>
                <ColourPicker
                  unset={null}
                  colour={setting.colour}
                  onChange={(colour) => {
                    if (colour) put({ ...setting, colour });
                  }}
                />
              </>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
