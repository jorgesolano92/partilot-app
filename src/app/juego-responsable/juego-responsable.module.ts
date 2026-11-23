import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { JuegoResponsablePageRoutingModule } from './juego-responsable-routing.module';
import { JuegoResponsablePage } from './juego-responsable.page';

@NgModule({
  imports: [CommonModule, IonicModule, JuegoResponsablePageRoutingModule],
  declarations: [JuegoResponsablePage],
})
export class JuegoResponsablePageModule {}
