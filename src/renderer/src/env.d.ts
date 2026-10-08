/// <reference types="vite/client" />

import type { CloseGuardBridge, DialogBridge, EngineBridge } from '../../shared/protocol';

declare global {
  interface Window {
    engine: EngineBridge;
    dialogs: DialogBridge;
    closeGuard: CloseGuardBridge;
  }
}
