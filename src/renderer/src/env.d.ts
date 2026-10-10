/// <reference types="vite/client" />

import type {
  CloseGuardBridge,
  DiagnosticsBridge,
  DialogBridge,
  EngineBridge,
  EngineRecoveryBridge,
  LicensesBridge,
  UpdatesBridge,
} from '../../shared/protocol';

declare global {
  interface Window {
    engine: EngineBridge;
    engineRecovery: EngineRecoveryBridge;
    dialogs: DialogBridge;
    closeGuard: CloseGuardBridge;
    updates: UpdatesBridge;
    diagnostics: DiagnosticsBridge;
    licenses: LicensesBridge;
  }
}
