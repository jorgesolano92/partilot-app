import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VentaPageRoutingModule } from './venta-routing.module';
import { AgeResponsibleBadgeModule } from '../shared/age-responsible-badge/age-responsible-badge.module';

import { VentaPage } from './venta.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VentaPageRoutingModule,
    AgeResponsibleBadgeModule,
  ],
  declarations: [VentaPage]
})
export class VentaPageModule {}
