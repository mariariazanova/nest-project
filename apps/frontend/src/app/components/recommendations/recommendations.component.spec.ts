import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationsComponent } from './recommendations.component';
import { suggestionServiceMockProvider } from '../../../../test/mocks/suggestion.service.mock';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { suggestionItemMock, suggestionMock } from '../../../../test/mocks/suggestion.mock';
import { SuggestionService } from '../../services/suggestion.service';

describe('RecommendationsComponent', () => {
  let component: RecommendationsComponent;
  let fixture: ComponentFixture<RecommendationsComponent>;
  let suggestionServiceMock: SuggestionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationsComponent, HttpClientTestingModule],
      providers: [suggestionServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendationsComponent);
    suggestionServiceMock = TestBed.inject(SuggestionService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update recommendations and show page when data is present', () => {
    expect(component.recommendations).toEqual(suggestionMock.items);
    expect(component.isRecommendationsPageShown).toBe(true);
    expect(component.isLoading).toBe(false);
  });

  it('should call setSuggestions(null) on destroy', () => {
    component.ngOnDestroy();

    expect(suggestionServiceMock.setSuggestions).toHaveBeenCalledWith(null);
  });

  it('#returnChoicePage should clear suggestions and hide page', () => {
    component.isRecommendationsPageShown = true;

    component.returnChoicePage();

    expect(suggestionServiceMock.setSuggestions).toHaveBeenCalledWith(null);
    expect(component.isRecommendationsPageShown).toBe(false);
  });

  it('#showTooltip should show tooltip with correct position', () => {
    const targetMock = document.createElement('div');

    targetMock.classList.add('recommendations-container');
    document.body.appendChild(targetMock);

    vi.spyOn(targetMock, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 150,
      bottom: 150,
      width: 50,
      height: 50,
    } as DOMRect);

    const mouseEvent = <MouseEvent>(<unknown>{
      target: targetMock,
    });

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 700,
    });

    component.showTooltip(suggestionItemMock, mouseEvent);

    expect(component.activeTooltip).toBe(suggestionItemMock);
    expect(component.tooltipPosition.top).toBe(100);
    expect(component.tooltipPosition.left).toBe(60);
  });

  it('#hideTooltip should hide tooltip', () => {
    const targetMock = document.createElement('div');

    targetMock.classList.add('recommendations-container');
    document.body.appendChild(targetMock);

    const mouseEvent = <MouseEvent>(<unknown>{
      target: targetMock,
    });

    component.showTooltip(suggestionItemMock, mouseEvent);
    component.hideTooltip();

    expect(component.activeTooltip).toBeNull();
  });
});
