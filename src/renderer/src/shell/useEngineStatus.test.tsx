import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineCommand } from '../../../shared/protocol';
import { installFakeEngine, type FakeEngine } from '../test-engine';
import { HEARTBEAT_MS, useEngineStatus } from './useEngineStatus';

const pings = (engine: FakeEngine) =>
  engine.sent.filter((c): c is Extract<EngineCommand, { type: 'ping' }> => c.type === 'ping');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useEngineStatus', () => {
  it('waits for the first reply, then is running', () => {
    const engine = installFakeEngine();
    const { result } = renderHook(() => useEngineStatus());
    expect(result.current).toEqual({ state: 'waiting' });
    engine.emit({ type: 'pong', id: pings(engine)[0]!.id, uptimeMs: 12_000 });
    expect(result.current).toMatchObject({ state: 'running', uptimeMs: 12_000 });
  });

  it('pings on every heartbeat', () => {
    const engine = installFakeEngine();
    renderHook(() => useEngineStatus());
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 2));
    expect(pings(engine)).toHaveLength(3);
  });

  it('is not responding when a ping goes unanswered for a heartbeat, until a reply comes', () => {
    const engine = installFakeEngine();
    const { result } = renderHook(() => useEngineStatus());
    engine.emit({ type: 'pong', id: pings(engine)[0]!.id, uptimeMs: 1000 });
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(result.current.state).toBe('running');
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(result.current).toEqual({ state: 'notResponding' });
    engine.emit({ type: 'pong', id: pings(engine).at(-1)!.id, uptimeMs: 5000 });
    expect(result.current.state).toBe('running');
  });

  it('ignores replies to pings it did not send', () => {
    const engine = installFakeEngine();
    const { result } = renderHook(() => useEngineStatus());
    engine.emit({ type: 'pong', id: -1, uptimeMs: 1000 });
    expect(result.current).toEqual({ state: 'waiting' });
  });
});
