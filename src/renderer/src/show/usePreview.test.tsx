import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeEngine } from '../test-engine';
import { usePreview } from './usePreview';

afterEach(() => vi.unstubAllGlobals());

describe('usePreview', () => {
  it('keeps the engine sending while another Preview is still mounted', () => {
    const engine = installFakeEngine();
    const types = () => engine.sent.map((c) => c.type);
    const show = renderHook(() => usePreview());
    const perform = renderHook(() => usePreview());
    expect(types()).toEqual(['startPreview', 'startPreview']);

    show.unmount();
    expect(types()).toEqual(['startPreview', 'startPreview']);
    perform.unmount();
    expect(types()).toEqual(['startPreview', 'startPreview', 'stopPreview']);
  });
});
