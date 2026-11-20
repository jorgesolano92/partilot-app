import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VendedorPageRoutingModule } from './vendedor-routing.module';
import { AgeResponsibleBadgeModule } from '../shared/age-responsible-badge/age-responsible-badge.module';

import { VendedorPage } from './vendedor.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VendedorPageRoutingModule,
    AgeResponsibleBadgeModule,
  ],
  declarations: [VendedorPage]
})
export class VendedorPageModule {}
