import { publicSchedulesClient, UserScheduleDetail } from "@/modules/services/pilates";

export default async function PilatesSchedulePage({
  params,
}: {
  params: Promise<{ scheduleId: string }>;
}) {
  const { scheduleId } = await params;
  const schedule = await publicSchedulesClient.get(scheduleId).catch(() => null);

  if (!schedule) {
    return (
      <section className="rounded-2xl border border-error/30 bg-card-bg-primary p-8 text-center">
        <h1 className="text-xl font-bold text-txt-primary">Schedule unavailable</h1>
        <p className="mt-2 text-sm text-txt-secondary">
          This class schedule could not be found or is no longer available.
        </p>
      </section>
    );
  }

  return <UserScheduleDetail schedule={schedule} />;
}
