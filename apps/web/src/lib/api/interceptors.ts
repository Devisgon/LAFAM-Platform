import { toAppError } from "@/lib/error/handleError";
export async function parseApiResponse<TData>(response: Response): Promise<TData> {
  if (!response.ok) throw toAppError(undefined, response.status);
  return (await response.json()) as TData;
}

