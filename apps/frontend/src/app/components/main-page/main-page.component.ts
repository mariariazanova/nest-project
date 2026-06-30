import { Component, computed, inject } from '@angular/core';
import { SmartPicksComponent } from '../smart-picks/smart-picks.component';
import { RecommendationsComponent } from '../recommendations/recommendations.component';
import { SuggestionService } from '../../services/suggestion.service';

@Component({
  standalone: true,
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
  imports: [SmartPicksComponent, RecommendationsComponent],
})
export class MainPageComponent {
  appTitle = 'Polecajka – kliknij klimat';

  private readonly suggestionService = inject(SuggestionService);

  readonly recommendationReceived = computed(
    () => !!this.suggestionService.suggestions() || this.suggestionService.isSuggestionLoading(),
  );
}
