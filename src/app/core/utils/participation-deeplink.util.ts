export interface ParticipationDeepLinkParams {
  ref: string | null;
  sig: string | null;
}

/** Extrae ref y sig de un App Link HTTPS o de texto QR. */
export function extraerParamsParticipacionDeUrl(url: string): ParticipationDeepLinkParams {
  try {
    const parsed = new URL(url);
    return {
      ref: parsed.searchParams.get('ref')?.trim() || null,
      sig: parsed.searchParams.get('sig')?.trim() || null,
    };
  } catch {
    const refMatch = url.match(/[?&]ref=([^&#]+)/);
    const sigMatch = url.match(/[?&]sig=([^&#]+)/);

    if (refMatch || sigMatch) {
      return {
        ref: refMatch ? decodeURIComponent(refMatch[1]).trim() : null,
        sig: sigMatch ? decodeURIComponent(sigMatch[1]).trim() : null,
      };
    }

    const trimmed = url.trim();
    return trimmed ? { ref: trimmed, sig: null } : { ref: null, sig: null };
  }
}

export function esUrlComprobacionParticipacion(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');

    return parsed.hostname === 'partilot.es'
      && (path === '/comprobar-participaciones' || path.endsWith('/comprobar-participaciones'));
  } catch {
    return url.includes('comprobar-participaciones');
  }
}

export function queryParamsDesdeDeepLink(url: string): Record<string, string> | null {
  const { ref, sig } = extraerParamsParticipacionDeUrl(url);
  if (!ref) {
    return null;
  }

  const queryParams: Record<string, string> = { ref };
  if (sig) {
    queryParams['sig'] = sig;
  }

  return queryParams;
}
