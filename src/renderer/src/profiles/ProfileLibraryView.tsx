import { useEffect, useRef, useState } from 'react';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import { blankProfile, profileName } from '../../../shared/profile-edit';
import { useFindShortcut } from '../shell/useShortcuts';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { FixtureImportDialog } from './FixtureImportDialog';
import { ProfileEditor } from './ProfileEditor';
import styles from './ProfileLibraryView.module.css';
import { ProfileList } from './ProfileList';
import { filterProfiles, sameProfile } from './profiles';
import { useProfileLibrary } from './useProfileLibrary';

// What the editor is open on: a library Profile by id, or a new one.
type Target = { id: string } | 'new';

const BLANK = blankProfile();

// The Profile Library: the Profile list beside the Profile Editor. Edits are
// a draft until saved (ADR 0004); switching away from unsaved edits asks
// first, and closing the window offers to save them. While `active`, Ctrl+F
// searches the Profiles.
export function ProfileLibraryView({ active }: { active: boolean }) {
  const { entries, importOfl, importGdtf, saveProfile, deleteProfile } = useProfileLibrary();
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Target>();
  // Counts each opening, so the editor starts afresh, but not after a save
  // that renames the target.
  const [opened, setOpened] = useState(0);
  // Unsaved edits to the target; undefined when there are none.
  const [draft, setDraft] = useState<FixtureProfile>();
  // Why the engine refused the last save.
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // Saves the draft when the window closes; true when there was none to save.
  const saveBeforeClose = useRef(async () => true);

  useFindShortcut(active, () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  });

  const isNew = target === 'new';
  const selectedId = isNew ? undefined : target?.id;
  const base = isNew ? BLANK : entries.find((e) => e.profile.id === selectedId)?.profile;
  const shown = draft ?? base;

  function setEdits(next: FixtureProfile | undefined) {
    setDraft(next);
    setErrors([]);
  }

  // Resolves to whether the target may change: no draft, or it was discarded.
  async function discardDraft(): Promise<boolean> {
    if (!draft) return true;
    const yes = await confirm({
      title:
        base && !isNew ? `Discard changes to ${profileName(base)}?` : 'Discard the new Profile?',
      message: 'The Profile has unsaved changes.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (yes) setEdits(undefined);
    return yes;
  }

  async function open(next: Target) {
    const same = next === 'new' ? isNew : next.id === selectedId;
    if (same) return;
    if (await discardDraft()) select(next);
  }

  function select(next: Target) {
    setTarget(next);
    setOpened((count) => count + 1);
  }

  // Resolves to whether `profile` was saved.
  async function save(profile: FixtureProfile): Promise<boolean> {
    setSaving(true);
    let result: string[];
    try {
      result = await saveProfile(profile, selectedId);
    } catch (error) {
      toast({ tone: 'error', message: `Save failed: ${(error as Error).message}` });
      return false;
    } finally {
      setSaving(false);
    }
    setErrors(result);
    if (result.length > 0) return false;
    setTarget({ id: profile.id });
    // Edits made while it was saving stay a draft.
    setDraft((current) => (current === profile ? undefined : current));
    toast({ tone: 'success', message: `${profileName(profile)} saved` });
    return true;
  }

  useEffect(() => {
    saveBeforeClose.current = async () => {
      if (!draft) return true;
      const saved = await save(draft);
      if (!saved) toast({ tone: 'error', message: 'The Profile was not saved.' });
      return saved;
    };
  });
  useEffect(() => window.closeGuard.setUnsaved('profile', draft !== undefined), [draft]);
  useEffect(
    () => window.closeGuard.onSaveBeforeClose('profile', () => saveBeforeClose.current()),
    [],
  );

  async function remove(profile: FixtureProfile) {
    const yes = await confirm({
      title: `Delete ${profileName(profile)}?`,
      message: 'Venue Patches that use it keep their own copy.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!yes) return;
    deleteProfile(profile.id);
    setTarget(undefined);
    setEdits(undefined);
  }

  return (
    <div className={styles.view}>
      <ProfileList
        entries={filterProfiles(entries, query)}
        libraryEmpty={entries.length === 0}
        query={query}
        selectedId={selectedId}
        searchRef={searchRef}
        onQuery={setQuery}
        onSelect={(id) => void open({ id })}
        onRemove={() => base && !isNew && void remove(base)}
        onNew={() => void open('new')}
        onImport={async () => {
          // An import may replace the Profile being edited.
          if (await discardDraft()) setImporting(true);
        }}
      />
      {target && shown && base ? (
        <ProfileEditor
          key={opened}
          profile={shown}
          title={isNew ? 'New Profile' : profileName(base)}
          unsaved={draft !== undefined}
          isNew={isNew}
          errors={errors}
          saving={saving}
          onChange={(profile) => setEdits(sameProfile(profile, base) ? undefined : profile)}
          onSave={() => void save(shown)}
          onCancel={() => {
            setEdits(undefined);
            if (isNew) setTarget(undefined);
          }}
          onDelete={isNew ? undefined : () => void remove(base)}
        />
      ) : (
        <p className={styles.empty}>Select a Profile to edit it, or make a new one.</p>
      )}
      <FixtureImportDialog
        open={importing}
        onOpenChange={setImporting}
        importOfl={importOfl}
        importGdtf={importGdtf}
        onImported={(id, name) => {
          toast({ tone: 'success', message: `Imported ${name}` });
          select({ id });
        }}
      />
    </div>
  );
}
