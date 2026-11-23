import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-age-responsible-badge',
  template: `
    <div class="age-responsible-badge" [class.compact]="compact">
      <span class="age-pill">+18</span>
      <span class="sep">|</span>
      <a *ngIf="linkToResponsibleGaming; else plain" routerLink="/juego-responsable" class="jr-link">Juego responsable</a>
      <ng-template #plain><span class="jr-text">Juego responsable</span></ng-template>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .age-responsible-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 8px 0 4px;
      font-size: 12px;
      font-weight: 600;
      color: #444;
      letter-spacing: 0.02em;
    }
    .age-responsible-badge.compact {
      margin: 4px 0;
      font-size: 11px;
    }
    .age-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 2px 6px;
      border-radius: 999px;
      background: #111;
      color: #fff;
      font-size: 11px;
      line-height: 1.2;
    }
    .sep { color: #999; }
    .jr-link {
      color: #c45c26;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .jr-text { color: #444; }
  `],
  standalone: false,
})
export class AgeResponsibleBadgeComponent {
  @Input() compact = false;
  @Input() linkToResponsibleGaming = true;
}
