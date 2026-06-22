import { QueryClient } from "@tanstack/react-query";
import { QUERY_STALE_TIME_MS } from "@/constants/config";
export function createQueryClient(): QueryClient { return new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS, refetchOnWindowFocus: false, refetchOnMount: false, retry: 1 }, mutations: { retry: 0 } } }); }

