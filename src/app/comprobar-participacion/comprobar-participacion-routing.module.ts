import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ComprobarParticipacionPage } from './comprobar-participacion.page';

const routes: Routes = [
  {
    path: '',
    component: ComprobarParticipacionPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ComprobarParticipacionPageRoutingModule {}
