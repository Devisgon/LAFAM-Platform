export type ApiResponse<TData> = { data: TData; message: string; status: number; timestamp_ms: number };
export type AppErrorCode = "bad_request" | "forbidden" | "not_found" | "rate_limited" | "session_expired" | "unknown";
export class AppError extends Error {
  constructor(public readonly code: AppErrorCode, message: string, public readonly status: number = 500) {
    super(message);
    this.name = "AppError";
  }
}

