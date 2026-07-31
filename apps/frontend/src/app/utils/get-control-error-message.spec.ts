import { UntypedFormControl, Validators } from '@angular/forms';
import { getControlErrorMessages } from './get-control-error-message';
import {
  defaultInputError,
  minLengthError,
  noxExistingUser,
  passwordError,
  requiredError,
} from '../constants/error';

describe('getControlErrorMessage', () => {
  const controlMock = new UntypedFormControl('value');

  it('should return null if control has no validation errors', () => {
    expect(getControlErrorMessages(controlMock)).toBeNull();
  });

  it('should return error message if control is invalid due to requirement', () => {
    const controlMock = new UntypedFormControl('', Validators.required);

    expect(getControlErrorMessages(controlMock)).toBe(requiredError);
  });

  it('should return error message if control is invalid due to non-existing', () => {
    const controlMock = new UntypedFormControl();

    controlMock.setErrors({ loginError: true });

    expect(getControlErrorMessages(controlMock)).toBe(noxExistingUser);
  });

  it('should return error message if control is invalid due to invalid password', () => {
    const controlMock = new UntypedFormControl();

    controlMock.setErrors({ passwordError: true });

    expect(getControlErrorMessages(controlMock)).toBe(passwordError);
  });

  it('should return error message if control is invalid due to min length', () => {
    const controlMock = new UntypedFormControl('value', Validators.minLength(6));

    expect(getControlErrorMessages(controlMock)).toBe(minLengthError);
  });

  it('should return default error message for unknown error type', () => {
    const control = new UntypedFormControl();

    control.setErrors({ unknownError: true });

    expect(getControlErrorMessages(control)).toBe(defaultInputError);
  });
});
