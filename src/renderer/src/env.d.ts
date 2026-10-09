/// <reference types="vite/client" />

import type {
  CloseGuardBridge,
  DialogBridge,
  EngineBridge,
  UpdatesBridge,
} from '../../shared/protocol';

declare global {
  interface Window {
    engine: EngineBridge;
    dialogs: DialogBridge;
    closeGuard: CloseGuardBridge;
    updates: UpdatesBridge;
  }
}
