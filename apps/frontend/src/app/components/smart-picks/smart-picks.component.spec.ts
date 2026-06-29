import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmartPicksComponent } from './smart-picks.component';
import { SuggestionService } from '../../services/suggestion.service';
import { Group } from '../../enums/group';
import { suggestionServiceMockProvider } from '../../../../test/mocks/suggestion.service.mock';
import { userServiceMockProvider } from '../../../../test/mocks/user.service.mock';
import { userChoiceMock } from '../../../../test/mocks/user-choice.mock';

describe('SmartPicksComponent', () => {
  let component: SmartPicksComponent;
  let fixture: ComponentFixture<SmartPicksComponent>;
  let suggestionService: SuggestionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmartPicksComponent],
      providers: [suggestionServiceMockProvider, userServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(SmartPicksComponent);
    suggestionService = TestBed.inject(SuggestionService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('#isMoodAndCategoryTagSelected should return correct value from isMoodAndCategoryTagSelected', () => {
    component.currentStep = 0;
    component.userChoice.mood = 'happy';

    expect(component.isMoodAndCategoryTagSelected).toBeTrue();

    component.currentStep = 1;

    expect(component.isMoodAndCategoryTagSelected).toBeFalse();

    component.userChoice.category = 'BOOK';

    expect(component.isMoodAndCategoryTagSelected).toBeTrue();
  });

  it('#slides should return slides with correct length', () => {
    component.currentStep = 1;

    expect(component.slides.length).toBe(3);
  });

  it('#slides should add genre slide at correct step', () => {
    component.userChoice.category = 'BOOK';
    component.currentStep = 2;

    expect(component.slides.length).toBe(4);
  });

  it('#isSelected should detect selected tag correctly', () => {
    component.userChoice.mood = 'excited';

    expect(component.isSelected('excited', Group.MOOD)).toBeTrue();
    expect(component.isSelected('sad', Group.MOOD)).toBeFalse();
  });

  it('#onTagClick should toggle tag selection on click', () => {
    component.onTagClick('happy', Group.MOOD);

    expect(component.userChoice.mood).toBe('happy');

    component.onTagClick('happy', Group.MOOD);

    expect(component.userChoice.mood).toBeUndefined();
  });

  it('#goNextStep should move to next step', () => {
    expect(component.currentStep).toBe(0);

    component.goNextStep();

    expect(component.currentStep).toBe(1);
  });

  it('#goNextStep should call getSuggestions on last step', () => {
    component.currentStep = 3;
    component.userChoice = userChoiceMock;

    component.goNextStep();

    expect(suggestionService.setSuggestions).toHaveBeenCalledWith(null);
    expect(suggestionService.getSuggestions).toHaveBeenCalledWith({
      userId: 'user-id',
      criteria: userChoiceMock,
    });
    // expect(suggestionService.setSuggestions).toHaveBeenCalledWith(suggestionMock);
  });

  it('#returnPreviousStep should return to previous step and clear that step value', () => {
    component.currentStep = 2;
    component.userChoice.genre = 'fantasy';

    component.returnPreviousStep();

    expect(component.currentStep).toBe(1);
    expect(component.userChoice.genre).toBeUndefined();
  });

  it('#onClearClick should clear all selections on clear', () => {
    component.userChoice = userChoiceMock;

    component.onClearClick();

    expect(component.userChoice).toEqual({
      mood: undefined,
      category: undefined,
      genre: undefined,
      tag: undefined,
    });
    expect(suggestionService.setSuggestions).toHaveBeenCalledWith(null);
  });
});
