export function completeIonRefresher(event: CustomEvent): void {
  const refresher = event.target as HTMLIonRefresherElement | null;
  refresher?.complete();
}

/** Ejecuta `reload` y cierra el refresher cuando `isLoading` pasa a false (o tras timeout). */
export function refreshWithLoadingWatch(
  event: CustomEvent,
  isLoading: () => boolean,
  reload: () => void,
  maxMs = 15000
): void {
  const refresher = event.target as HTMLIonRefresherElement;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    refresher?.complete();
  };

  reload();

  if (!isLoading()) {
    finish();
    return;
  }

  const started = Date.now();
  const tick = () => {
    if (!isLoading() || Date.now() - started > maxMs) {
      finish();
      return;
    }
    setTimeout(tick, 80);
  };
  setTimeout(tick, 80);
}
