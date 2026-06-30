import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { MainPageComponent } from './main-page.component';
import { suggestionServiceMockProvider } from '../../../../test/mocks/suggestion.service.mock';
import { SuggestionService } from '../../services/suggestion.service';

describe('MainPageComponent', () => {
  let component: MainPageComponent;
  let fixture: ComponentFixture<MainPageComponent>;
  let suggestionService: SuggestionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainPageComponent, HttpClientTestingModule],
      providers: [suggestionServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(MainPageComponent);
    suggestionService = TestBed.inject(SuggestionService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it(`should have correct title`, () => {
    expect(component.appTitle).toBe('Polecajka – kliknij klimat');
  });

  it('should set recommendationReceived to true when suggestions exist', () => {
    expect(component.recommendationReceived()).toBe(true);
  });

  it('should set recommendationReceived to false if no suggestions', () => {
    suggestionService.suggestions.set(null);

    expect(component.recommendationReceived()).toBe(false);
  });
});
