import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EliminarCuentaPageRoutingModule } from './eliminar-cuenta-routing.module';
import { EliminarCuentaPage } from './eliminar-cuenta.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EliminarCuentaPageRoutingModule,
  ],
  declarations: [EliminarCuentaPage],
})
export class EliminarCuentaPageModule {}
