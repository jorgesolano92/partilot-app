// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',
  // apiUrl: 'https://panel.partilot.es/api',

  /**
   * Ruta relativa a `apiUrl` para registrar el token FCM (POST JSON `{ fcm_token }`).
   * Laravel: `NotificationController::registerToken` bajo middleware `auth.api`.
   */
  fcmDeviceRegisterPath: 'notifications/register-token' as string | null,

  /** POST JSON `{ fcm_token }` — quitar este dispositivo antes de cerrar sesión. */
  fcmDeviceUnregisterPath: 'notifications/unregister-token' as string | null,
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
