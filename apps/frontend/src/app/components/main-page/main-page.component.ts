import { Component, effect } from '@angular/core';
import { NgIf } from '@angular/common';
import { SmartPicksComponent } from '../smart-picks/smart-picks.component';
import { RecommendationsComponent } from '../recommendations/recommendations.component';
import { SuggestionService } from '../../services/suggestion.service';

@Component({
  standalone: true,
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
  imports: [SmartPicksComponent, RecommendationsComponent, NgIf],
})
export class MainPageComponent {
  appTitle = 'Polecajka – kliknij klimat';
  recommendationReceived = false;

  constructor(private readonly suggestionService: SuggestionService) {
    effect(() => {
      this.recommendationReceived =
        !!this.suggestionService.suggestions() || this.suggestionService.isSuggestionLoading();
    });
  }
}
