import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AuthService } from '../core/services/auth.service';
import { BiometricService } from '../core/services/biometric.service';
import {
  esUrlComprobacionParticipacion,
  queryParamsDesdeDeepLink,
} from '../core/utils/participation-deeplink.util';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: false,
})
export class SplashPage implements OnInit, OnDestroy {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private biometricService: BiometricService
  ) {}

  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const handled = await this.tryHandleColdStartDeepLink();
      if (handled) {
        return;
      }
    }

    this.timeoutId = setTimeout(() => this.navigateAfterSplash(), 3000);
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  private navigateAfterSplash(): void {
    const path = (this.router.url || '').split('?')[0];
    if (path !== '' && path !== '/') {
      return;
    }

    if (this.authService.isLoggedIn()) {
      if (this.biometricService.mustShowBiometricGate()) {
        this.router.navigate(['/biometric-unlock'], { replaceUrl: true });
        return;
      }
      this.authService.navigateToDefaultHome();
    } else {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  /** Arranque en frío desde QR / App Link (antes del redirect automático a login). */
  private async tryHandleColdStartDeepLink(): Promise<boolean> {
    try {
      const launch = await App.getLaunchUrl();
      const url = launch?.url;
      if (!url || !esUrlComprobacionParticipacion(url)) {
        return false;
      }

      if (this.authService.isLoggedIn()) {
        const queryParams = queryParamsDesdeDeepLink(url);
        if (queryParams) {
          await this.router.navigate(['/tabs/comprobar-participacion'], {
            queryParams,
            replaceUrl: true,
          });
          return true;
        }
      }

      await this.router.navigate(['/registro'], { replaceUrl: true });
      return true;
    } catch {
      return false;
    }
  }
}
