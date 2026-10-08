import { FileUp, Plus } from 'lucide-react';
import type { Ref } from 'react';
import type { ProfileLibraryEntry } from '../../../shared/protocol';
import { FIND_SHORTCUT } from '../shell/shortcuts';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SearchField } from '../ui/fields';
import { List } from '../ui/List';
import styles from './ProfileList.module.css';
import { profileName } from '../../../shared/profile-edit';
import { modeSummary } from './profiles';

interface ProfileListProps {
  // The entries the search leaves.
  entries: ProfileLibraryEntry[];
  // Whether the library has no Profile at all, rather than none that match.
  libraryEmpty: boolean;
  query: string;
  selectedId: string | undefined;
  searchRef: Ref<HTMLInputElement>;
  onQuery(query: string): void;
  onSelect(id: string): void;
  onRemove(): void;
  onNew(): void;
  onImport(): void;
}

// The Profile Library, searched by manufacturer and model, with each
// Profile's source and modes. Arrow keys select, Del deletes the selected.
export function ProfileList({
  entries,
  libraryEmpty,
  query,
  selectedId,
  searchRef,
  onQuery,
  onSelect,
  onRemove,
  onNew,
  onImport,
}: ProfileListProps) {
  return (
    <div className={styles.column}>
      <SearchField
        label="Search Profiles"
        placeholder={`Search Profiles (${FIND_SHORTCUT})`}
        inputRef={searchRef}
        value={query}
        onChange={onQuery}
      />
      <List
        label="Profiles"
        items={entries}
        getKey={(entry) => entry.profile.id}
        selectedKey={selectedId}
        onSelect={onSelect}
        onDelete={onRemove}
        className={styles.list}
        empty={
          libraryEmpty ? 'No Profiles yet. Import one from OFL or make one.' : 'No Profiles match'
        }
        renderItem={({ profile, handEdited }) => (
          <span className={styles.item}>
            <span className={styles.top}>
              <span className={styles.name}>{profileName(profile)}</span>
              <Badge tone={handEdited ? 'accent' : 'neutral'} className={styles.badge}>
                {handEdited ? 'Edited' : 'OFL'}
              </Badge>
            </span>
            <span className={styles.summary}>{modeSummary(profile)}</span>
          </span>
        )}
      />
      <div className={styles.buttons}>
        <Button icon={<Plus />} onClick={onNew}>
          New Profile
        </Button>
        <Button icon={<FileUp />} onClick={onImport}>
          Import OFL
        </Button>
      </div>
    </div>
  );
}
