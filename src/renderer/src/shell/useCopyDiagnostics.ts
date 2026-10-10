import type { MidiInputStatus, OutputStatus } from '../../../shared/protocol';
import type { TempoState } from '../panel/useTempo';
import { useToast } from '../ui/Toast';
import { diagnosticsText } from './diagnostics';

// Copies the diagnostics for a bug report to the clipboard. Main gives the
// app info; the Outputs, MIDI Input and Tempo are the renderer's own state.
export function useCopyDiagnostics(
  outputs: OutputStatus[] | undefined,
  midiInput: MidiInputStatus | undefined,
  tempo: TempoState | undefined,
): () => Promise<void> {
  const toast = useToast();
  return async () => {
    const app = await window.diagnostics.appInfo().catch(() => undefined);
    const text = diagnosticsText({ app, outputs, midiInput, tempo });
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', message: 'Diagnostics copied' });
    } catch {
      toast({ tone: 'error', message: 'Could not copy the diagnostics.' });
    }
  };
}
