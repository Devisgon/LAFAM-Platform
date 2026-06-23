import {
  PilatesClassManager,
  publicClassesClient,
  UserClasses,
} from "@/modules/services/pilates";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
import type { PublicClassFilters, PublicClassLevel } from "@/modules/services/pilates";

type SearchParams = Record<string, string | string[] | undefined>;

const PUBLIC_CLASS_LEVELS: PublicClassLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "all_levels",
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveFilters(searchParams: SearchParams): PublicClassFilters {
  const level = firstParam(searchParams.level);

  return {
    search: firstParam(searchParams.search),
    level: PUBLIC_CLASS_LEVELS.includes(level as PublicClassLevel)
      ? (level as PublicClassLevel)
      : undefined,
    from_date: firstParam(searchParams.from_date),
    to_date: firstParam(searchParams.to_date),
  };
}

export default async function PilatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession();
  if (isAdminRole(session?.role)) return <PilatesClassManager />;
  const filters = resolveFilters(await searchParams);
  const initialResult = await publicClassesClient.list(filters).catch(() => undefined);
  return <UserClasses filters={filters} initialResult={initialResult} />;
}
