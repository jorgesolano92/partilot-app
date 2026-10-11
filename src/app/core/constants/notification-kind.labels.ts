/**
 * Etiquetas para `tipo` (notifications.kind en API). Ampliar cuando se añadan kinds en Laravel.
 * Ver docs/SCHEDULER_AND_KIND_LABELS.md en el backend.
 */
export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  // Panel
  manual_entidad: 'Entidad',
  push_directo_panel: 'Mensaje directo',
  // API / jobs
  regalo_participacion: 'Regalo',
  regalo_rechazado: 'Regalo rechazado',
  regalo_aceptado: 'Regalo aceptado',
  cobro_registrado: 'Cobro',
  invitacion_vendedor: 'Invitación vendedor',
  asignacion_participaciones: 'Asignación',
  resultados_sorteo: 'Resultados',
  // Legacy / mock UI (capturas)
  cobro: 'Cobro',
  regalo: 'Regalo',
  sorteo: 'Sorteo',
  ganador: 'Premio',
  manual: 'Aviso',
};

export function notificationKindLabel(kind: string | null | undefined): string {
  if (!kind) {
    return 'Notificación';
  }
  return NOTIFICATION_KIND_LABELS[kind] ?? kind;
}

/**
 * Agrupa kinds del backend con el comportamiento UI legacy (iconos, botones "Gestionar").
 */
export function normalizeNotificationTipoForUi(kind: string): string {
  const map: Record<string, string> = {
    cobro_registrado: 'cobro',
    regalo_participacion: 'regalo',
    regalo_rechazado: 'regalo',
    regalo_aceptado: 'regalo',
    resultados_sorteo: 'sorteo',
  };
  return map[kind] ?? kind;
}
