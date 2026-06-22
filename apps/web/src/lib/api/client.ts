import { REQUEST_TIMEOUT_MS } from "@/constants/config";
import { parseApiResponse } from "./interceptors";
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
async function request<TData>(path: string, init: RequestInit = {}): Promise<TData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, credentials: "include", signal: controller.signal, headers: { Accept: "application/json", ...init.headers } });
    return await parseApiResponse<TData>(response);
  } finally { clearTimeout(timeout); }
}
export const apiClient = {
  get: <TData>(path: string, init?: RequestInit) => request<TData>(path, { ...init, method: "GET" }),
  post: <TData>(path: string, body?: unknown, init?: RequestInit) => request<TData>(path, { ...init, method: "POST", headers: { "Content-Type": "application/json", ...init?.headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
};

