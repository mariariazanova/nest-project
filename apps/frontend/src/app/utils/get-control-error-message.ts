import { AbstractControl } from '@angular/forms';
import {
  defaultInputError,
  minLengthError,
  noxExistingUser,
  passwordError,
  requiredError,
  userNameExistingError,
} from '../constants/error';
import { ValidationKey } from '../enums/validation-key';

export const getControlErrorMessages = (control: AbstractControl): string | null => {
  if (!control.errors) {
    return null;
  }

  if (control.errors) {
    const errorsKeys = Object.keys(control.errors);
    let errorMessage;

    if (errorsKeys.includes(ValidationKey.Required)) {
      errorMessage = requiredError;
    } else if (errorsKeys.includes(ValidationKey.LoginError)) {
      errorMessage = noxExistingUser;
    } else if (errorsKeys.includes(ValidationKey.PasswordError)) {
      errorMessage = passwordError;
    } else if (errorsKeys.includes(ValidationKey.MinLength)) {
      errorMessage = minLengthError;
    } else if (errorsKeys.includes(ValidationKey.UserError)) {
      errorMessage = userNameExistingError;
    } else {
      errorMessage = defaultInputError;
    }

    return errorMessage ?? null;
  }

  return null;
};
