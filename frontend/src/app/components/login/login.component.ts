import { Component, DestroyRef, EventEmitter, inject, OnInit, Output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
} from '@angular/forms';
import { NgIf } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY } from 'rxjs';
import { LoginService } from '../../services/login.service';
import { UserService } from '../../services/user.service';
import { UserWithoutId, UserWithoutPassword } from '../../interfaces/user';
import { getControlErrorMessages } from '../../utils/get-control-error-message';
import { noxExistingUser, passwordError, userNameExistingError } from '../../constants/error';
import { Property } from '../../enums/property';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, NgIf, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  @Output() login = new EventEmitter<UserWithoutPassword>();
  @Output() cancel = new EventEmitter<void>();

  loginForm!: UntypedFormGroup;

  private readonly destroyRef = inject(DestroyRef);

  get isNewAccountCreated(): boolean {
    return this.loginForm.get('isNewAccountCreated')?.value;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: LoginService,
    private readonly userService: UserService,
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  onLogin() {
    const userName = this.loginForm.get('userName')?.value;
    const userPassword = this.loginForm.get('password')?.value;

    if (userName && userPassword) {
      const loggingUser: UserWithoutId = {
        username: userName,
        password: userPassword,
      };

      const request$ = this.isNewAccountCreated
        ? this.userService.createUser(loggingUser)
        : this.userService.login(loggingUser);

      request$
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError((er) => {
            const message = er?.error?.message ?? '';

            if (message === passwordError) {
              this.loginForm.get(Property.PASSWORD)?.setErrors({ passwordError: message });
            } else if (message === noxExistingUser) {
              this.loginForm.get(Property.USERNAME)?.setErrors({ loginError: message });
            } else if (message === userNameExistingError) {
              this.loginForm.get(Property.USERNAME)?.setErrors({ userError: message });
            }
            return EMPTY;
          }),
        )
        .subscribe((res) => {
          this.login.emit(res.user);
        });
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  getErrorMessage(controlName: string): string | null {
    const control = this.loginForm.get(controlName);

    return control ? getControlErrorMessages(control) : null;
  }

  private initForm(): void {
    this.loginForm = this.fb.group({
      isNewAccountCreated: new UntypedFormControl(false),
      userName: new UntypedFormControl(null, [this.requiredTrimmed, this.minLengthTrimmed(3)]),
      password: new UntypedFormControl(null, [this.requiredTrimmed, this.minLengthTrimmed(3)]),
    });
  }

  private requiredTrimmed(control: AbstractControl): ValidationErrors | null {
    const value = control.value?.toString().trim();

    return value ? null : { required: true };
  }

  private minLengthTrimmed(min: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value?.toString().trim();

      return value?.length >= min
        ? null
        : { minlength: { requiredLength: min, actualLength: value?.length } };
    };
  }
}
