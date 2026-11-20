import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LoteriaSocialPageRoutingModule } from './loteria-social-routing.module';
import { AgeResponsibleBadgeModule } from '../shared/age-responsible-badge/age-responsible-badge.module';

import { LoteriaSocialPage } from './loteria-social.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LoteriaSocialPageRoutingModule,
    AgeResponsibleBadgeModule,
  ],
  declarations: [LoteriaSocialPage]
})
export class LoteriaSocialPageModule {}
