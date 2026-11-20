import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { JuegoResponsablePage } from './juego-responsable.page';

const routes: Routes = [
  {
    path: '',
    component: JuegoResponsablePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JuegoResponsablePageRoutingModule {}
