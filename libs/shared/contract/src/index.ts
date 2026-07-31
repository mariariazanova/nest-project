import { initContract } from '@ts-rest/core';
import { authContract } from './lib/auth.contract';
import { suggestionContract } from './lib/suggestion.contract';
import { favoriteContract } from './lib/favorite.contract';
import { historyContract } from './lib/history.contract';
import { fileContract } from './lib/file.contract';

// c is the ts-rest DSL builder — same convention as z for Zod. Used only to call c.router().
const c = initContract();

export const contract = c.router({
  auth: authContract,
  suggestion: suggestionContract,
  favorite: favoriteContract,
  history: historyContract,
  file: fileContract,
});

export {
  authContract,
  suggestionContract,
  favoriteContract,
  historyContract,
  fileContract,
};
export * from './lib/schemas';
export * from './lib/status';
