import { Routes } from '@angular/router';
import { MainPageComponent } from './components/main-page/main-page.component';
import { RecommendationsHistoryComponent } from './components/recommendations-history/recommendations-history.component';
import { FavoritesComponent } from './components/favorites/favorites.component';

export const routes: Routes = [
  { path: '', component: MainPageComponent },
  {
    path: 'recommendations-history',
    component: RecommendationsHistoryComponent,
  },
  { path: 'favorites', component: FavoritesComponent },
  { path: '**', redirectTo: '' },
];
