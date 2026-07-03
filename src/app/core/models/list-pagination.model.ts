export interface ParticipationListMeta {
  total: number;
  page: number;
  per_page: number;
  last_page: number;
  date_from: string;
  date_to: string;
}

export interface ParticipationListQuery {
  page: number;
  per_page: number;
  date_from: string;
  date_to: string;
  include_expired?: boolean;
  paginate: 1;
}

export const PER_PAGE_OPTIONS = [10, 20, 50] as const;

export const DEFAULT_LIST_MONTHS = 3;

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultListQuery(includeExpired = false): ParticipationListQuery {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - DEFAULT_LIST_MONTHS);

  return {
    page: 1,
    per_page: 20,
    date_from: toIsoDate(from),
    date_to: toIsoDate(to),
    include_expired: includeExpired,
    paginate: 1,
  };
}

export function listQueryToParams(query: ParticipationListQuery): Record<string, string> {
  const params: Record<string, string> = {
    page: String(query.page),
    per_page: String(query.per_page),
    date_from: query.date_from,
    date_to: query.date_to,
    paginate: '1',
  };

  if (query.include_expired) {
    params['include_expired'] = '1';
  }

  return params;
}
