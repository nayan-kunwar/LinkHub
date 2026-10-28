export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "CSRF_INVALID",
  "SIGNUP_DISABLED",
  "GOOGLE_SIGN_IN_DISABLED",
  "GOOGLE_TOKEN_INVALID",
  "GOOGLE_EMAIL_UNVERIFIED",
  "GOOGLE_NOT_LINKED",
  "GOOGLE_ALREADY_LINKED",
  "LAST_SIGN_IN_METHOD",
  "EMAIL_NOT_VERIFIED",
  "ACCOUNT_SUSPENDED",
  "LIMIT_REACHED",
  "NOT_FOUND",
  "USERNAME_TAKEN",
  "USERNAME_RESERVED",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  path?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const fail = {
  validation: (message = "The request could not be validated.", details?: ErrorDetail[]) =>
    new AppError(400, "VALIDATION_ERROR", message, details),
  tokenInvalid: (message = "This link is invalid or has already been used.") =>
    new AppError(400, "TOKEN_INVALID", message),
  tokenExpired: (message = "This link has expired. Request a new one.") =>
    new AppError(400, "TOKEN_EXPIRED", message),
  unauthenticated: (message = "Sign in to continue.") =>
    new AppError(401, "UNAUTHENTICATED", message),
  invalidCredentials: (message = "Email or password is incorrect.") =>
    new AppError(401, "INVALID_CREDENTIALS", message),
  forbidden: (message = "You do not have access to this resource.") =>
    new AppError(403, "FORBIDDEN", message),
  csrf: (message = "Your session could not be verified. Refresh and try again.") =>
    new AppError(403, "CSRF_INVALID", message),
  signupDisabled: (message = "Sign-ups are not open yet.") =>
    new AppError(403, "SIGNUP_DISABLED", message),
  googleSignInDisabled: (message = "Google sign-in is not available right now.") =>
    new AppError(503, "GOOGLE_SIGN_IN_DISABLED", message),
  googleTokenInvalid: (message = "Google sign-in could not be verified. Try again.") =>
    new AppError(401, "GOOGLE_TOKEN_INVALID", message),
  googleEmailUnverified: (message = "Your Google email address must be verified to continue.") =>
    new AppError(403, "GOOGLE_EMAIL_UNVERIFIED", message),
  googleNotLinked: (
    message = "This Google account is not linked. Sign in with your password, then connect Google in Settings.",
  ) => new AppError(403, "GOOGLE_NOT_LINKED", message),
  googleAlreadyLinked: (
    message = "This Google account is already linked to a Link Hub account.",
  ) => new AppError(409, "GOOGLE_ALREADY_LINKED", message),
  lastSignInMethod: (
    message = "Set a password before disconnecting your only sign-in method.",
  ) => new AppError(409, "LAST_SIGN_IN_METHOD", message),
  emailNotVerified: (message = "Verify your email address to continue.") =>
    new AppError(403, "EMAIL_NOT_VERIFIED", message),
  suspended: (message = "This account is suspended.") =>
    new AppError(403, "ACCOUNT_SUSPENDED", message),
  limitReached: (message = "You have reached your plan limit.") =>
    new AppError(403, "LIMIT_REACHED", message),
  notFound: (message = "Not found.") => new AppError(404, "NOT_FOUND", message),
  usernameTaken: (message = "That username is already taken.") =>
    new AppError(409, "USERNAME_TAKEN", message),
  usernameReserved: (message = "That username is reserved.") =>
    new AppError(409, "USERNAME_RESERVED", message),
  conflict: (message = "That change conflicts with an existing record.") =>
    new AppError(409, "CONFLICT", message),
  rateLimited: (message = "Too many requests. Try again later.") =>
    new AppError(429, "RATE_LIMITED", message),
  internal: (message = "Something went wrong. Try again.") =>
    new AppError(500, "INTERNAL_ERROR", message),
};
