import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  OnDestroy,
  Output,
} from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { SuggestionService } from '../../services/suggestion.service';
import { DataBaseRecommendItem } from '../../interfaces/data-base';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [NgForOf, NgIf],
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsComponent implements OnDestroy {
  @Output() recommendationRequired = new EventEmitter<boolean>();

  recommendations: DataBaseRecommendItem[] | null = null;
  activeTooltip: DataBaseRecommendItem | null = null;
  isRecommendationsPageShown = false;
  isLoading = false;
  tooltipPosition = { top: 0, left: 0 };

  constructor(
    private readonly suggestionService: SuggestionService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    effect(() => {
      const data = this.suggestionService.suggestions();
      const isDataLoading = this.suggestionService.isSuggestionLoading();

      if (isDataLoading) {
        this.isLoading = isDataLoading;
      }

      if (data) {
        this.recommendations = data.items;
        this.isRecommendationsPageShown = true;
        this.changeDetector.detectChanges();
      }
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
