/// <reference types="vite/client" />

import type {
  CloseGuardBridge,
  DialogBridge,
  EngineBridge,
  EngineRecoveryBridge,
  UpdatesBridge,
} from '../../shared/protocol';

declare global {
  interface Window {
    engine: EngineBridge;
    engineRecovery: EngineRecoveryBridge;
    dialogs: DialogBridge;
    closeGuard: CloseGuardBridge;
    updates: UpdatesBridge;
  }
}
