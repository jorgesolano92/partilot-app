import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import type {
  CapacitorBarcodeScannerOptions,
  CapacitorBarcodeScannerScanResult,
} from '@capacitor/barcode-scanner';

interface StoredBiometricCredentials {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class BiometricService {
  private readonly enabledKey = 'biometric_enabled';
  private readonly credsKey = 'biometric_login_credentials';
  private readonly biometryTypeKey = 'biometric_type';
  /** sessionStorage: sesión desbloqueada con biometría en esta instancia de la WebView (se invalida al pasar a segundo plano). */
  private readonly unlockSessionKey = 'partilot_biometric_unlock_ok';

  /**
   * El escáner nativo de QR suele poner la app en `isActive: false`; sin esto se invalida el desbloqueo
   * biométrico y al volver se fuerza /biometric-unlock perdiendo el flujo.
   */
  private nativeBarcodeScanDepth = 0;

  async isBiometryAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const info = await BiometricAuth.checkBiometry();
      localStorage.setItem(this.biometryTypeKey, String(info.biometryType ?? BiometryType.none));
      return info.isAvailable === true && info.biometryType !== BiometryType.none;
    } catch {
      return false;
    }
  }

  async getBiometryType(): Promise<BiometryType> {
    if (!Capacitor.isNativePlatform()) return BiometryType.none;
    try {
      const info = await BiometricAuth.checkBiometry();
      localStorage.setItem(this.biometryTypeKey, String(info.biometryType ?? BiometryType.none));
      return info.biometryType ?? BiometryType.none;
    } catch {
      return BiometryType.none;
    }
  }

  isBiometricEnabled(): boolean {
    return localStorage.getItem(this.enabledKey) === '1';
  }

  setBiometricEnabled(enabled: boolean): void {
    if (enabled) {
      localStorage.setItem(this.enabledKey, '1');
      return;
    }
    this.clearStoredLoginCredentials();
  }

  async getBiometricIconName(): Promise<string> {
    const type = await this.getBiometryType();
    if (type === BiometryType.faceId || type === BiometryType.faceAuthentication) {
      return 'scan-circle-outline';
    }
    return 'finger-print-outline';
  }

  async authenticate(): Promise<boolean> {
    if (!(await this.isBiometryAvailable())) return false;
    try {
      await BiometricAuth.authenticate({
        reason: 'Accede con biometría',
        cancelTitle: 'Cancelar',
        allowDeviceCredential: false,
      });
      return true;
    } catch {
      return false;
    }
  }

  async saveLoginCredentials(email: string, password: string): Promise<void> {
    if (!this.isBiometricEnabled()) return;
    localStorage.setItem(this.enabledKey, '1');
    const payload: StoredBiometricCredentials = { email, password };
    localStorage.setItem(this.credsKey, JSON.stringify(payload));
  }

  getStoredLoginCredentials(): StoredBiometricCredentials | null {
    if (localStorage.getItem(this.enabledKey) !== '1') return null;
    const raw = localStorage.getItem(this.credsKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredBiometricCredentials;
      if (!parsed?.email || !parsed?.password) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  clearStoredLoginCredentials(): void {
    localStorage.removeItem(this.enabledKey);
    localStorage.removeItem(this.credsKey);
    localStorage.removeItem(this.biometryTypeKey);
  }

  /** True mientras está abierto el lector nativo de códigos (no tratar ese “pause” como salida de la app). */
  isNativeBarcodeScanInProgress(): boolean {
    return this.nativeBarcodeScanDepth > 0;
  }

  /**
   * Ejecuta el escáner nativo incrementando el contador **antes** de cualquier `await`
   * (si no, `appStateChange` puede dispararse durante el `import()` y aún invalidar biometría).
   */
  /** True si el error proviene de cancelar el escáner (no es fallo técnico; no mostrar alerta). */
  isScanCancelled(error: unknown): boolean {
    const msg = String(
      (error as { message?: string; errorMessage?: string })?.message
        ?? (error as { errorMessage?: string })?.errorMessage
        ?? error
        ?? ''
    ).toLowerCase();
    return /cancel|canceled|cancelled|user\s+cancel|scan cancelled|operation cancelled|aborted/.test(msg);
  }

  scanBarcodeWithoutBiometricPause(
    options: CapacitorBarcodeScannerOptions
  ): Promise<CapacitorBarcodeScannerScanResult> {
    this.nativeBarcodeScanDepth++;
    const run = async (): Promise<CapacitorBarcodeScannerScanResult> => {
      try {
        const { CapacitorBarcodeScanner } = await import('@capacitor/barcode-scanner');
        return await CapacitorBarcodeScanner.scanBarcode(options);
      } finally {
        this.nativeBarcodeScanDepth = Math.max(0, this.nativeBarcodeScanDepth - 1);
      }
    };
    return run();
  }

  /** Al enviar la app a segundo plano: exigir biometría otra vez al volver. */
  invalidateBiometricUnlockSession(): void {
    try {
      sessionStorage.removeItem(this.unlockSessionKey);
    } catch {
      /* ignore */
    }
  }

  /** Tras autenticación biométrica correcta en esta sesión de app. */
  markBiometricUnlockSessionOk(): void {
    try {
      sessionStorage.setItem(this.unlockSessionKey, '1');
    } catch {
      /* ignore */
    }
  }

  /**
   * ¿Hay que mostrar la pantalla de desbloqueo antes de usar la app?
   * Solo app nativa, con sesión, biometría activada y aún no desbloqueado en esta sesión.
   */
  mustShowBiometricGate(): boolean {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    if (!this.isBiometricEnabled()) {
      return false;
    }
    if (!localStorage.getItem('token')) {
      return false;
    }
    try {
      return sessionStorage.getItem(this.unlockSessionKey) !== '1';
    } catch {
      return true;
    }
  }
}
