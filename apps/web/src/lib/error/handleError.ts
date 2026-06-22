import { AppError } from "@/types/api.types";
import { ERROR_MESSAGES } from "./errorMap";
export function toAppError(error: unknown, status?: number): AppError {
  const resolvedStatus = status ?? (error instanceof AppError ? error.status : 500);
  if (error instanceof AppError) return error;
  if (resolvedStatus === 401) return new AppError("session_expired", ERROR_MESSAGES.session_expired, resolvedStatus);
  if (resolvedStatus === 403) return new AppError("forbidden", ERROR_MESSAGES.forbidden, resolvedStatus);
  if (resolvedStatus === 404) return new AppError("not_found", ERROR_MESSAGES.not_found, resolvedStatus);
  if (resolvedStatus === 429) return new AppError("rate_limited", ERROR_MESSAGES.rate_limited, resolvedStatus);
  if (resolvedStatus >= 400 && resolvedStatus < 500) return new AppError("bad_request", ERROR_MESSAGES.bad_request, resolvedStatus);
  return new AppError("unknown", ERROR_MESSAGES.unknown, resolvedStatus);
}
export function getSafeErrorMessage(error: unknown): string { return toAppError(error).message; }

