import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AgeResponsibleBadgeComponent } from './age-responsible-badge.component';

@NgModule({
  declarations: [AgeResponsibleBadgeComponent],
  imports: [CommonModule, RouterModule],
  exports: [AgeResponsibleBadgeComponent],
})
export class AgeResponsibleBadgeModule {}
