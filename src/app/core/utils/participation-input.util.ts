/** Formato de participación física: SS/NNNNN (2 dígitos set + 5 dígitos número). */

export function sanitizeParticipationDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, 7);
}

export function formatParticipationInput(raw: string): string {
  const digits = sanitizeParticipationDigits(raw);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function parseParticipationInput(value: string): {
  setNumber: number;
  participationNumber: number | null;
} | null {
  const trimmed = (value || '').trim();
  const match = trimmed.match(/^(\d{2})\/(\d{0,5})$/);
  if (!match) {
    return null;
  }
  return {
    setNumber: parseInt(match[1], 10),
    participationNumber: match[2].length === 5 ? parseInt(match[2], 10) : null,
  };
}

export function isParticipationInputComplete(value: string): boolean {
  return /^\d{2}\/\d{5}$/.test((value || '').trim());
}

export function hasSetPrefixComplete(value: string): boolean {
  return /^\d{2}\//.test((value || '').trim());
}

export function setPrefixKey(value: string): string {
  const setNumber = extractSetNumber(value);
  return setNumber != null ? String(setNumber).padStart(2, '0') : (value || '').trim();
}

export function extractSetNumber(value: string): number | null {
  const trimmed = (value || '').trim();
  const parsed = parseParticipationInput(trimmed);
  if (parsed) {
    return parsed.setNumber;
  }
  const match = trimmed.match(/^(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

/** True si ambos valores vacíos, incompletos o pertenecen al mismo set (SS). */
export function sameParticipationSet(a: string, b: string): boolean {
  if (!a?.trim() || !b?.trim()) {
    return true;
  }
  const setA = extractSetNumber(a);
  const setB = extractSetNumber(b);
  if (setA == null || setB == null) {
    return true;
  }
  return setA === setB;
}

/** Número de participación (parte tras SS/), p. ej. 01/00002 → 2 */
export function extractParticipationNumber(value: string): number {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return 0;
  }
  const parsed = parseParticipationInput(trimmed);
  if (parsed?.participationNumber != null) {
    return parsed.participationNumber;
  }
  if (trimmed.includes('/')) {
    const afterSlash = trimmed.split('/')[1] ?? '';
    const n = parseInt(afterSlash, 10);
    return isNaN(n) ? 0 : n;
  }
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : n;
}
