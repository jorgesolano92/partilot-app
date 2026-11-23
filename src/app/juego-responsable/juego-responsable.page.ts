import { Component } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { ExternalLinkService } from '../core/services/external-link.service';

@Component({
  selector: 'app-juego-responsable',
  templateUrl: './juego-responsable.page.html',
  styleUrls: ['./juego-responsable.page.scss'],
  standalone: false,
})
export class JuegoResponsablePage {
  /** Texto oficial del PDF «Juego responsable.pdf» (FEJAR / jugarbien.es). */
  readonly fejarPhone = '900 200 225';
  readonly fejarPhoneTel = '900200225';
  readonly fejarUrl = 'https://fejar.org/';
  readonly jugarBienUrl = 'https://jugarbien.es/';

  constructor(
    public authService: AuthService,
    private externalLinks: ExternalLinkService
  ) {}

  openJugarBien(): void {
    void this.externalLinks.open(this.jugarBienUrl);
  }

  openFejar(): void {
    void this.externalLinks.open(this.fejarUrl);
  }
}
