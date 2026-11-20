export const environment = {
  production: true,
  apiUrl: 'https://panel.partilot.es/api',
  /** Web de usuario (Lotería Social → «Juega aquí» abre el navegador externo). */
  loteriaSocialWebUrl: 'https://partilot.es',
  fcmDeviceRegisterPath: 'notifications/register-token' as string | null,
  fcmDeviceUnregisterPath: 'notifications/unregister-token' as string | null,
};
