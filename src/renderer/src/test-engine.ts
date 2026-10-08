// A fake `window.engine` for component tests: records the commands sent and
// lets a test send events, or answer commands as they arrive.
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { EngineBridge, EngineCommand, EngineEvent } from '../../shared/protocol';

export interface FakeEngine {
  sent: EngineCommand[];
  // Sends `event` to every listener.
  emit(event: EngineEvent): void;
}

// Installs the fake. `answer` returns the events to send back for a command.
export function installFakeEngine(
  answer: (command: EngineCommand) => EngineEvent[] = () => [],
): FakeEngine {
  const listeners = new Set<(event: EngineEvent) => void>();
  const sent: EngineCommand[] = [];
  const emit = (event: EngineEvent) => listeners.forEach((listener) => listener(event));
  const bridge: EngineBridge = {
    send(command) {
      sent.push(command);
      // Async, like the real engine.
      queueMicrotask(() => answer(command).forEach(emit));
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  vi.stubGlobal('engine', bridge);
  return { sent, emit: (event) => act(() => emit(event)) };
}
