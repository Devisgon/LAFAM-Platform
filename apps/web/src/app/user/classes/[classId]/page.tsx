import { UserClassDetail } from "@/components/user_components/user_class_detail";
import {
  publicClassesClient,
  type PublicPilatesClass,
} from "@/lib/user/classes";

export default async function UserClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  let item: PublicPilatesClass | null = null;

  try {
    item = await publicClassesClient.get(classId);
  } catch {
  }

  if (!item) {
    return (
      <section className="rounded-2xl border border-error/30 bg-card-bg-primary p-8 text-center">
        <h1 className="text-xl font-bold text-txt-primary">Class unavailable</h1>
        <p className="mt-2 text-sm text-txt-secondary">
          This class could not be found or is no longer available.
        </p>
      </section>
    );
  }

  return <UserClassDetail item={item} />;
}
