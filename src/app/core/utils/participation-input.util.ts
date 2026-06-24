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
  const trimmed = (value || '').trim();
  return trimmed.length >= 3 ? trimmed.slice(0, 3) : trimmed;
}
