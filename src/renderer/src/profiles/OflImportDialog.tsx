import { useState } from 'react';
import type { UnsupportedFeature } from '../../../shared/fixture-profile';
import type { OflImportResult } from '../../../shared/protocol';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { FieldFrame, InlineInput, parseName, useInlineEdit } from '../ui/fields';
import styles from './OflImportDialog.module.css';

type ImportOfl = (
  json: unknown,
  manufacturer: string,
  overwrite?: boolean,
) => Promise<OflImportResult>;

interface OflImportDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  importOfl: ImportOfl;
  // After a Profile was imported, by id and name.
  onImported(id: string, name: string): void;
}

// Imports a fixture file from the Open Fixture Library. Overwriting a
// hand-edited Profile asks first. Unsupported features are listed before the
// dialog closes.
export function OflImportDialog({ open, onOpenChange, ...rest }: OflImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Import from Open Fixture Library">
      {/* Mounted while open, so each opening starts afresh. */}
      {open && <OflImportForm {...rest} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

// What the last attempt left to say: a problem, or what was imported.
type Report = { error: string } | { imported: string; unsupported: string[] } | { kept: string };

function OflImportForm({
  importOfl,
  onImported,
  onClose,
}: Omit<OflImportDialogProps, 'open' | 'onOpenChange'> & { onClose(): void }) {
  const confirm = useConfirm();
  const [file, setFile] = useState<File>();
  const [typedManufacturer, setTypedManufacturer] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report>();
  const manufacturer = useInlineEdit({
    value: typedManufacturer,
    format: String,
    parse: parseName,
    onCommit: setTypedManufacturer,
  });
  // Undefined until the user types one.
  const manufacturerName = manufacturer.parsed || undefined;

  if (report && 'imported' in report) {
    return (
      <div className={styles.form}>
        <p>Imported {report.imported}. These features are not supported:</p>
        <ul className={styles.unsupported}>
          {report.unsupported.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <footer className={styles.footer}>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </footer>
      </div>
    );
  }

  async function importFile(chosen: File, chosenManufacturer: string) {
    let json: unknown;
    try {
      json = JSON.parse(await chosen.text());
    } catch {
      setReport({ error: `${chosen.name} is not valid JSON.` });
      return;
    }
    let result = await importOfl(json, chosenManufacturer);
    if (
      result.status === 'conflict' &&
      (await confirm({
        title: 'Overwrite the hand-edited Profile?',
        message: `${result.name} was edited by hand. Overwrite it with the OFL version?`,
        confirmLabel: 'Overwrite',
        cancelLabel: 'Keep it',
        destructive: true,
      }))
    ) {
      result = await importOfl(json, chosenManufacturer, true);
    }
    switch (result.status) {
      case 'imported':
        onImported(result.profileId, result.name);
        if (result.unsupported.length === 0) onClose();
        else setReport({ imported: result.name, unsupported: result.unsupported.map(describe) });
        break;
      case 'conflict':
        setReport({ kept: result.name });
        break;
      case 'failed':
        setReport({ error: `Import failed: ${result.error}` });
        break;
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!file || !manufacturerName) return;
        setBusy(true);
        void importFile(file, manufacturerName)
          .catch((error: Error) => setReport({ error: `Import failed: ${error.message}` }))
          .finally(() => setBusy(false));
      }}
    >
      <FieldFrame label="Fixture file" hint="An OFL fixture .json file">
        {({ inputId, describedBy }) => (
          <input
            id={inputId}
            type="file"
            accept=".json"
            aria-describedby={describedBy}
            className={styles.file}
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        )}
      </FieldFrame>
      <InlineInput label="Manufacturer" edit={manufacturer} />
      {report && 'error' in report && (
        <p role="alert" className={styles.error}>
          {report.error}
        </p>
      )}
      {report && 'kept' in report && (
        <p className={styles.message}>Kept the hand-edited {report.kept}.</p>
      )}
      <footer className={styles.footer}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!file || !manufacturerName || busy}>
          Import
        </Button>
      </footer>
    </form>
  );
}

function describe({ feature, mode, channel }: UnsupportedFeature): string {
  return feature + (mode ? ` (mode ${mode})` : '') + (channel ? ` (channel ${channel})` : '');
}
