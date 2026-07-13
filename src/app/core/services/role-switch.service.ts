import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AppRole, AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class RoleSwitchService {

  constructor(
    private alertController: AlertController,
    private authService: AuthService
  ) {}

  /**
   * Muestra confirmación al cambiar de rol si el usuario tiene más de uno.
   * @returns true si se aplicó el cambio, false si se canceló o no hubo cambio.
   */
  async confirmRoleChange(
    targetRol: AppRole,
    currentRol?: AppRole,
    apply?: () => void
  ): Promise<void> {
    const actual = currentRol ?? this.authService.getCurrentRol();
    if (targetRol === actual) {
      return;
    }

    if (!this.authService.showRoleSelector()) {
      apply?.();
      return;
    }

    const label = this.authService.getRolDisplayName(targetRol);
    const alert = await this.alertController.create({
      header: `¿Ver la aplicación como ${label}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Continuar',
          handler: () => apply?.(),
        },
      ],
    });

    await alert.present();
  }
}
