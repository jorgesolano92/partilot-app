import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AceptacionRolPageRoutingModule } from './aceptacion-rol-routing.module';
import { AceptacionRolPage } from './aceptacion-rol.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, AceptacionRolPageRoutingModule],
  declarations: [AceptacionRolPage],
})
export class AceptacionRolPageModule {}
