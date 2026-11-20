/** Edad mínima legal para juego en España. */
export const MIN_GAMBLING_AGE = 18;

/**
 * Calcula si una fecha de nacimiento (YYYY-MM-DD o Date) cumple la edad mínima.
 */
export function isAtLeastAge(birthDateInput: string | Date, minAge: number = MIN_GAMBLING_AGE): boolean {
  const birth = typeof birthDateInput === 'string' ? parseBirthDate(birthDateInput) : birthDateInput;
  if (!birth || Number.isNaN(birth.getTime())) {
    return false;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= minAge;
}

function parseBirthDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  // YYYY-MM-DD from <input type="date">
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}
