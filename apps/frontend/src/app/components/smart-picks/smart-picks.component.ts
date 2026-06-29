import { Component, DestroyRef, inject } from '@angular/core';
import { NgClass, NgForOf, NgIf } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, tap } from 'rxjs';
import { SuggestionService } from '../../services/suggestion.service';
import { UserService } from '../../services/user.service';
import { UserChoice, UserChoiceGroup } from '../../interfaces/user-choice';
import { CategoryType } from '../../interfaces/category';
import { Property } from '../../enums/property';
import { Category } from '../../enums/category';
import { Group } from '../../enums/group';
import { bookGenres, filmGenres, gameGenres, songGenres } from '../../constants/genre';
import { categoriesOptions, eventTagsOptions, moodTagsOptions } from '../../constants/categories';

@Component({
  selector: 'app-smart-picks',
  standalone: true,
  imports: [NgForOf, NgIf, NgClass],
  templateUrl: './smart-picks.component.html',
  styleUrl: './smart-picks.component.scss',
})
export class SmartPicksComponent {
  currentStep = 0;
  userChoice: UserChoice = {
    mood: undefined,
    category: undefined,
    genre: undefined,
    tag: undefined,
  };

  private slidesBase = [
    {
      title: 'Nastrój',
      value: Group.MOOD,
      tags: moodTagsOptions,
    },
    {
      title: 'Rodzaj',
      value: Group.CATEGORY,
      tags: categoriesOptions,
    },
    {
      title: 'Wydarzenia',
      value: Group.TAG,
      tags: eventTagsOptions,
    },
  ];

  private readonly steps = [Property.MOOD, Property.CATEGORY, Property.GENRE, Property.EVENT];
  private readonly genreStepIndex = 2;
  private readonly genreMap = {
    [Category.FIlM]: filmGenres,
    [Category.BOOK]: bookGenres,
    [Category.SONG]: songGenres,
    [Category.GAME]: gameGenres,
  };
  private readonly destroyRef = inject(DestroyRef);

  get slides() {
    const result = [...this.slidesBase];

    if (
      this.currentStep === this.genreStepIndex &&
      this.slidesBase.length === this.genreStepIndex + 1
    ) {
      const genreSlide = {
        title: 'Gatunki',
        value: Group.GENRE,
        tags: this.genreMap[<CategoryType>this.userChoice.category] || [],
      };

      result.splice(this.genreStepIndex, 0, genreSlide);
    }

    this.slidesBase = result;

    return result;
  }

  get isMoodAndCategoryTagSelected(): boolean {
    const { mood, category } = this.userChoice;

    const stepMoveMap = {
      [Group.MOOD]: () => !!mood,
      [Group.CATEGORY]: () => !!(mood && category),
      [Group.GENRE]: () => !!(mood && category),
      [Group.TAG]: () => !!(mood && category),
    };

    return stepMoveMap[this.slides[this.currentStep].value]();
  }

  constructor(
    private readonly suggestionService: SuggestionService,
    private readonly userService: UserService,
  ) {}

  isSelected(tag: string, group: UserChoiceGroup): boolean {
    return this.userChoice[group] === tag;
  }

  onTagClick(value: string, group: UserChoiceGroup): void {
    const choiceGroup = this.userChoice[group];

    this.userChoice[group] = choiceGroup === value ? undefined : value;
  }

  goNextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep += 1;
    } else {
      this.suggestionService
        .getSuggestions({
          userId: this.userService.userId!,
          criteria: {
            category: this.userChoice.category,
            mood: this.userChoice.mood,
            genre: this.userChoice.genre,
            tag: this.userChoice.tag,
          },
        })
        .pipe(
          tap(() => this.suggestionService.setSuggestions(null)),
          tap(() => this.suggestionService.setIsSuggestionLoading(true)),
          takeUntilDestroyed(this.destroyRef),
          catchError(() => {
            return of(null);
          }),
        )
        .subscribe((suggestion) => {
          console.log(suggestion);
          this.suggestionService.setIsSuggestionLoading(false);
          this.suggestionService.setSuggestions(suggestion);
        });
    }
  }

  returnPreviousStep(): void {
    if (this.currentStep > 0) {
      this.userChoice[this.slides[this.currentStep].value] = undefined;
      this.currentStep -= 1;
    }
  }

  onClearClick(): void {
    this.userChoice = {
      mood: undefined,
      category: undefined,
      genre: undefined,
      tag: undefined,
    };
    this.suggestionService.setSuggestions(null);
    this.currentStep = 0;
  }
}
