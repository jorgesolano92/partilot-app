import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class ExternalLinkService {
  /**
   * Abre una URL en el navegador del sistema (fuera de la WebView de la app).
   */
  async open(url: string): Promise<void> {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        // Sin @capacitor/browser: _system fuerza navegador externo en Android/iOS Capacitor.
        window.open(trimmed, '_system');
        return;
      }
    } catch {
      // fallback abajo
    }

    window.open(trimmed, '_blank', 'noopener,noreferrer');
  }
}
