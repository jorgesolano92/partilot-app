import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { authGuard } from '../core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      // Tabs para Usuario
      {
        path: 'tab1',
        loadChildren: () => import('../cartera/cartera.module').then(m => m.CarteraPageModule)
      },
      {
        path: 'tab2',
        loadChildren: () => import('../historial/historial.module').then(m => m.HistorialPageModule)
      },
      {
        path: 'tab3',
        loadChildren: () => import('../tab3/tab3.module').then(m => m.Tab3PageModule)
      },
      {
        path: 'tab4',
        loadChildren: () => import('../resultados/resultados.module').then(m => m.ResultadosPageModule)
      },
      {
        path: 'tab5',
        loadChildren: () => import('../escaner/escaner.module').then(m => m.EscanerPageModule)
      },
      {
        path: 'digitalizar-participacion',
        loadChildren: () => import('../digitalizar-participacion/digitalizar-participacion.module').then(m => m.DigitalizarParticipacionPageModule)
      },
      {
        path: 'cobrar-gestionar',
        loadChildren: () => import('../cobrar-gestionar/cobrar-gestionar.module').then(m => m.CobrarGestionarPageModule)
      },
      // Tabs para Vendedor (requieren login)
      {
        path: 'vendedor-tab1',
        loadChildren: () => import('../venta/venta.module').then(m => m.VentaPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'vendedor-tab2',
        loadChildren: () => import('../historial/historial.module').then(m => m.HistorialPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'vendedor-tab3',
        loadChildren: () => import('../vendedor/vendedor.module').then(m => m.VendedorPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'vendedor-tab4',
        loadChildren: () => import('../gestor-participaciones/gestor-participaciones.module').then(m => m.GestorParticipacionesPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'vendedor-tab5',
        loadChildren: () => import('../escaner/escaner.module').then(m => m.EscanerPageModule),
        canActivate: [authGuard]
      },
      // Tabs para Gestor
      {
        path: 'gestor-tab1',
        loadChildren: () => import('../gestor-participaciones/gestor-participaciones.module').then(m => m.GestorParticipacionesPageModule)
      },
      {
        path: 'gestor-tab2',
        loadChildren: () => import('../gestor-vendedores/gestor-vendedores.module').then(m => m.GestorVendedoresPageModule)
      },
      {
        path: 'gestor-tab3',
        loadChildren: () => import('../gestor-home/gestor-home.module').then(m => m.GestorHomePageModule)
      },
      {
        path: 'gestor-tab4',
        loadChildren: () => import('../gestor-devolucion/gestor-devolucion.module').then(m => m.GestorDevolucionPageModule)
      },
      {
        path: 'gestor-tab5',
        loadChildren: () => import('../gestor-pago/gestor-pago.module').then(m => m.GestorPagoPageModule)
      },
      {
        path: 'gestor-asignacion',
        loadChildren: () => import('../gestor-asignacion/gestor-asignacion.module').then(m => m.GestorAsignacionPageModule)
      },
      {
        path: 'comprobar-numero',
        loadChildren: () => import('../comprobar-numero/comprobar-numero.module').then(m => m.ComprobarNumeroPageModule)
      },
      {
        path: 'comprobar-participacion',
        loadChildren: () => import('../comprobar-participacion/comprobar-participacion.module').then(m => m.ComprobarParticipacionPageModule)
      },
      {
        path: 'notificaciones',
        loadChildren: () => import('../notificaciones/notificaciones.module').then(m => m.NotificacionesPageModule)
      },
      {
        path: 'notificacion-detalle',
        loadChildren: () =>
          import('../notificacion-detalle/notificacion-detalle.module').then(m => m.NotificacionDetallePageModule),
      },
      {
        path: '',
        redirectTo: '/tabs/tab3',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/tab3',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
