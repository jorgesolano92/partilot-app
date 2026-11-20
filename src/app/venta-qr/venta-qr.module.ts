import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VentaQrPageRoutingModule } from './venta-qr-routing.module';
import { AgeResponsibleBadgeModule } from '../shared/age-responsible-badge/age-responsible-badge.module';

import { VentaQRPage } from './venta-qr.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VentaQrPageRoutingModule,
    AgeResponsibleBadgeModule,
  ],
  declarations: [VentaQRPage]
})
export class VentaQrPageModule {}
