import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import { SuggestionService } from '../../services/suggestion.service';
import { DataBaseRecommendItem } from '../../interfaces/data-base';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [],
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsComponent implements OnDestroy {
  recommendations: DataBaseRecommendItem[] | null = null;
  activeTooltip: DataBaseRecommendItem | null = null;
  isRecommendationsPageShown = false;
  isLoading = false;
  tooltipPosition = { top: 0, left: 0 };

  private readonly suggestionService = inject(SuggestionService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      const data = this.suggestionService.suggestions();
      const isDataLoading = this.suggestionService.isSuggestionLoading();

      this.isLoading = isDataLoading;

      if (data) {
        this.recommendations = data.items;
        this.isRecommendationsPageShown = true;
      }

      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.suggestionService.setSuggestions(null);
  }

  returnChoicePage(): void {
    this.suggestionService.setSuggestions(null);
    this.isRecommendationsPageShown = false;
  }

  showTooltip(item: DataBaseRecommendItem, event: MouseEvent) {
    this.activeTooltip = item;

    // Get the position of the hovered element
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const container = target.closest('.recommendations-container');
    const containerRect = container?.getBoundingClientRect();
    const screenWidth = window.innerWidth;

    if (containerRect) {
      if (screenWidth < 600) {
        this.tooltipPosition = {
          top: rect.bottom + 10,
          left: rect.left - containerRect.left,
        };
      } else {
        this.tooltipPosition = {
          top: rect.top,
          left: rect.right - containerRect.left + 10,
        };
      }
    }
  }

  hideTooltip() {
    this.activeTooltip = null;
  }
}
