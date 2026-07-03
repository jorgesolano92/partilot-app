import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  defaultListQuery,
  ParticipationListMeta,
  ParticipationListQuery,
  PER_PAGE_OPTIONS,
} from '../../core/models/list-pagination.model';

@Component({
  selector: 'app-participation-list-filters',
  templateUrl: './participation-list-filters.component.html',
  styleUrls: ['./participation-list-filters.component.scss'],
  standalone: false,
})
export class ParticipationListFiltersComponent {
  @Input({ required: true }) query!: ParticipationListQuery;
  @Input() showIncludeExpired = false;
  @Input() meta: ParticipationListMeta | null = null;
  @Input() loading = false;

  @Output() filtersApply = new EventEmitter<void>();
  @Output() pageChange = new EventEmitter<number>();

  readonly perPageOptions = PER_PAGE_OPTIONS;
  filtersExpanded = false;

  get hasCustomFilters(): boolean {
    if (!this.query) {
      return false;
    }

    const def = defaultListQuery(false);

    return this.query.date_from !== def.date_from
      || this.query.date_to !== def.date_to
      || Number(this.query.per_page) !== def.per_page
      || !!this.query.include_expired;
  }

  toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
  }

  onApply(): void {
    this.filtersApply.emit();
    this.filtersExpanded = false;
  }

  goPrev(): void {
    if (!this.meta || this.meta.page <= 1) return;
    this.pageChange.emit(this.meta.page - 1);
  }

  goNext(): void {
    if (!this.meta || this.meta.page >= this.meta.last_page) return;
    this.pageChange.emit(this.meta.page + 1);
  }
}
