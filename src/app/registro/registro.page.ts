import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { LegalService, LegalClientConfig } from '../core/services/legal.service';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: false,
})
export class RegistroPage implements OnInit {
  email = '';
  password = '';
  fechaNacimiento = '';
  aceptarCondiciones = false;
  loading = false;
  showPassword = false;
  legalConfig: LegalClientConfig | null = null;
  legalConfigLoaded = false;

  constructor(
    private router: Router,
    private alertController: AlertController,
    public authService: AuthService,
    private legalService: LegalService
  ) {}

  ngOnInit() {
    this.legalService.getClientConfig().subscribe((config) => {
      this.legalConfig = config;
      this.legalConfigLoaded = true;
    });
  }

  ionViewDidEnter() {
    if (this.authService.isLoggedIn()) {
      this.authService.navigateToDefaultHome('/tabs/tab3');
    }
  }

  get registrationLabel(): string {
    return (
      this.legalConfig?.registration?.checkbox_label ||
      'He leído y acepto los Términos y Condiciones de Uso, la Política de Privacidad y el Marco Legal Integral de PARTILOT.'
    );
  }

  get canSubmit(): boolean {
    return (
      !this.loading &&
      this.aceptarCondiciones &&
      !!this.email.trim() &&
      !!this.password &&
      !!this.fechaNacimiento
    );
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (!this.email.trim() || !this.password) {
      await this.mostrarAlerta('Atención', 'Introduce email y contraseña.');
      return;
    }
    if (!this.fechaNacimiento) {
      await this.mostrarAlerta('Atención', 'Introduce tu fecha de nacimiento.');
      return;
    }
    if (!this.aceptarCondiciones) {
      await this.mostrarAlerta('Atención', 'Debes aceptar las condiciones de uso antes de crear la cuenta.');
      return;
    }

    this.loading = true;
    this.authService.register(this.email, this.password, this.fechaNacimiento).subscribe({
      next: (response) => {
        this.loading = false;
        if (!response?.success || !response?.token) {
          void this.mostrarAlerta(
            'Registro incompleto',
            'Tu cuenta puede haberse creado, pero no se inició la sesión. Prueba a acceder con tu email y contraseña.'
          );
          this.router.navigate(['/login'], { replaceUrl: true });
          return;
        }
        this.authService.navigateToDefaultHome('/tabs/tab3');
      },
      error: async (err) => {
        this.loading = false;
        const errors = err.error?.errors as Record<string, string[]> | undefined;
        const message =
          err.error?.message ||
          (errors
            ? ([] as string[]).concat(...Object.values(errors)).join(' ')
            : 'Error al registrar. Intenta de nuevo.');
        await this.mostrarAlerta('Error', message);
      },
    });
  }

  irALogin() {
    this.router.navigate(['/login']);
  }

  abrirDocumento(slug: string) {
    this.router.navigate(['/documento-legal'], { queryParams: { slug } });
  }

  verCondiciones() {
    this.abrirDocumento('terminos-y-condiciones');
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
