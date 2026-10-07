import { useState, type FormEvent } from 'react';
import type { FixtureProfile } from '../../../shared/fixture-profile';
import { blankProfile } from '../../../shared/profile-edit';
import type { OflImportResult } from '../../../shared/protocol';
import { ProfileEditor } from './ProfileEditor';
import { useProfileLibrary } from './useProfileLibrary';

// What the editor is open on: a new Profile, or an existing one by id.
type Editing = { profile: FixtureProfile; replaces?: string };

export function ProfileLibraryView() {
  const { entries, importOfl, saveProfile, deleteProfile } = useProfileLibrary();
  const [editing, setEditing] = useState<Editing>();

  if (editing) {
    return (
      <ProfileEditor
        initial={editing.profile}
        onSave={(profile) => saveProfile(profile, editing.replaces)}
        onClose={() => setEditing(undefined)}
      />
    );
  }

  return (
    <section>
      <h2>Profile Library</h2>
      <button type="button" onClick={() => setEditing({ profile: blankProfile() })}>
        New Profile
      </button>
      <OflImportForm importOfl={importOfl} />
      {entries.length === 0 ? (
        <p>No Profiles yet. Import an OFL fixture or make one.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>Modes</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map(({ profile, handEdited }) => (
              <tr key={profile.id}>
                <td>{profile.manufacturer}</td>
                <td>{profile.model}</td>
                <td>{profile.modes.map((m) => m.name).join(', ')}</td>
                <td>{handEdited ? 'Edited by hand' : 'OFL'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => setEditing({ profile, replaces: profile.id })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete ${profile.manufacturer} ${profile.model}?`)) {
                        deleteProfile(profile.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function OflImportForm({
  importOfl,
}: {
  importOfl: (json: unknown, manufacturer: string, overwrite?: boolean) => Promise<OflImportResult>;
}) {
  const [file, setFile] = useState<File>();
  const [manufacturer, setManufacturer] = useState('');
  const [message, setMessage] = useState<string[]>([]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setMessage([`${file.name} is not valid JSON.`]);
      return;
    }
    let result = await importOfl(json, manufacturer);
    if (
      result.status === 'conflict' &&
      window.confirm(`"${result.profileId}" was edited by hand. Overwrite it with the OFL version?`)
    ) {
      result = await importOfl(json, manufacturer, true);
    }
    setMessage(describeImport(result));
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <h3>Import from Open Fixture Library</h3>
      <label>
        Fixture file{' '}
        <input type="file" accept=".json" onChange={(e) => setFile(e.target.files?.[0])} />
      </label>{' '}
      <label>
        Manufacturer{' '}
        <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
      </label>{' '}
      <button type="submit" disabled={!file || !manufacturer.trim()}>
        Import
      </button>
      {message.length > 0 && (
        <ul>
          {message.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

function describeImport(result: OflImportResult): string[] {
  switch (result.status) {
    case 'imported':
      return [
        `Imported ${result.profileId}.`,
        ...result.unsupported.map(
          (u) =>
            `Unsupported: ${u.feature}` +
            (u.mode ? ` (mode ${u.mode})` : '') +
            (u.channel ? ` (channel ${u.channel})` : ''),
        ),
      ];
    case 'conflict':
      return [`Kept the hand-edited ${result.profileId}.`];
    case 'failed':
      return [`Import failed: ${result.error}`];
  }
}
