import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ComprobarParticipacionPageRoutingModule } from './comprobar-participacion-routing.module';

import { ComprobarParticipacionPage } from './comprobar-participacion.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ComprobarParticipacionPageRoutingModule,
  ],
  declarations: [ComprobarParticipacionPage],
})
export class ComprobarParticipacionPageModule {}
