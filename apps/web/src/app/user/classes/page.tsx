import { UserClasses } from "@/components/user_components/user_classes";
import {
  publicClassesClient,
  type PublicClassFilters,
  type PublicClassLevel,
} from "@/lib/user/classes";

function value(input: string | string[] | undefined): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function level(input: string | string[] | undefined): PublicClassLevel | undefined {
  const selected = value(input);
  return selected === "beginner" ||
    selected === "intermediate" ||
    selected === "advanced" ||
    selected === "all_levels"
    ? selected
    : undefined;
}

function date(input: string | string[] | undefined): string | undefined {
  const selected = value(input);
  return selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : undefined;
}

export default async function UserClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters: PublicClassFilters = {
    search: value(query.search),
    level: level(query.level),
    from_date: date(query.from_date),
    to_date: date(query.to_date),
  };
  const initialResult = await publicClassesClient.list(filters).catch(() => undefined);

  return <UserClasses filters={filters} initialResult={initialResult} />;
}
