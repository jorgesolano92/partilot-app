import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { loggedInGuard } from './core/guards/logged-in.guard';
import { roleAcceptanceGuard } from './core/guards/role-acceptance.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'biometric-unlock',
    loadChildren: () =>
      import('./biometric-unlock/biometric-unlock.module').then(m => m.BiometricUnlockPageModule),
  },
  {
    path: 'registro',
    loadChildren: () => import('./registro/registro.module').then(m => m.RegistroPageModule)
  },
  {
    path: '',
    loadChildren: () => import('./splash/splash.module').then(m => m.SplashPageModule)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [loggedInGuard, roleAcceptanceGuard]
  },
  {
    path: 'digitalizar-participacion',
    redirectTo: '/tabs/digitalizar-participacion',
    pathMatch: 'full'
  },
  {
    path: 'regalar-participacion',
    loadChildren: () => import('./regalar-participacion/regalar-participacion.module').then( m => m.RegalarParticipacionPageModule)
  },
  {
    path: 'movimientos',
    loadChildren: () => import('./movimientos/movimientos.module').then( m => m.MovimientosPageModule)
  },
  {
    path: 'notificaciones',
    redirectTo: '/tabs/notificaciones',
    pathMatch: 'full'
  },
  {
    path: 'notificacion-detalle',
    loadChildren: () => import('./notificacion-detalle/notificacion-detalle.module').then( m => m.NotificacionDetallePageModule)
  },
  {
    path: 'preguntas-frecuentes',
    loadChildren: () => import('./preguntas-frecuentes/preguntas-frecuentes.module').then( m => m.PreguntasFrecuentesPageModule)
  },
  {
    path: 'condiciones-legales',
    loadChildren: () => import('./condiciones-legales/condiciones-legales.module').then( m => m.CondicionesLegalesPageModule)
  },
  {
    path: 'documento-legal',
    loadChildren: () => import('./documento-legal/documento-legal.module').then(m => m.DocumentoLegalPageModule)
  },
  {
    path: 'aceptacion-rol',
    loadChildren: () => import('./aceptacion-rol/aceptacion-rol.module').then(m => m.AceptacionRolPageModule),
    canActivate: [loggedInGuard]
  },
  {
    path: 'vendedor',
    loadChildren: () => import('./vendedor/vendedor.module').then( m => m.VendedorPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'venta',
    loadChildren: () => import('./venta/venta.module').then( m => m.VentaPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'venta-qr',
    loadChildren: () => import('./venta-qr/venta-qr.module').then( m => m.VentaQrPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'venta-manual',
    loadChildren: () => import('./venta-manual/venta-manual.module').then( m => m.VentaManualPageModule),
    canActivate: [authGuard]
  },
      {
        path: 'gestor-participaciones',
        loadChildren: () => import('./gestor-participaciones/gestor-participaciones.module').then( m => m.GestorParticipacionesPageModule)
      },
      {
        path: 'gestor-home',
        loadChildren: () => import('./gestor-home/gestor-home.module').then( m => m.GestorHomePageModule)
      },
      {
        path: 'gestor-vendedores',
        loadChildren: () => import('./gestor-vendedores/gestor-vendedores.module').then( m => m.GestorVendedoresPageModule)
      },
      {
        path: 'gestor-devolucion',
        loadChildren: () => import('./gestor-devolucion/gestor-devolucion.module').then( m => m.GestorDevolucionPageModule)
      },
      {
        path: 'gestor-pago',
        loadChildren: () => import('./gestor-pago/gestor-pago.module').then( m => m.GestorPagoPageModule)
      },
  {
    path: 'config-venta',
    loadChildren: () => import('./config-venta/config-venta.module').then( m => m.ConfigVentaPageModule)
  },
  {
    path: 'cuenta-cobro',
    loadChildren: () => import('./cuenta-cobro/cuenta-cobro.module').then( m => m.CuentaCobroPageModule)
  },
  {
    path: 'perfil',
    loadChildren: () => import('./perfil/perfil.module').then( m => m.PerfilPageModule)
  },
  {
    path: 'cartera',
    loadChildren: () => import('./cartera/cartera.module').then( m => m.CarteraPageModule)
  },
  {
    path: 'escaner',
    loadChildren: () => import('./escaner/escaner.module').then( m => m.EscanerPageModule)
  },
  {
    path: 'resultados',
    loadChildren: () => import('./resultados/resultados.module').then( m => m.ResultadosPageModule)
  },
  {
    path: 'comprobar-numero',
    redirectTo: '/tabs/comprobar-numero',
    pathMatch: 'full'
  },
  {
    path: 'loteria-social',
    loadChildren: () => import('./loteria-social/loteria-social.module').then( m => m.LoteriaSocialPageModule)
  },
  {
    path: 'entidad-detalle',
    loadChildren: () => import('./entidad-detalle/entidad-detalle.module').then( m => m.EntidadDetallePageModule)
  },
  {
    path: 'historial',
    loadChildren: () => import('./historial/historial.module').then( m => m.HistorialPageModule)
  },
  {
    path: 'cobrar-gestionar',
    redirectTo: '/tabs/cobrar-gestionar',
    pathMatch: 'full'
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
