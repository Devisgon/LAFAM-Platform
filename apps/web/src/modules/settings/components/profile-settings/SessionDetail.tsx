export function SessionDetail({
  label: detailLabel,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="font-bold text-txt-primary">{detailLabel}</dt>
      <dd className="mt-0.5">{value ?? "Not available"}</dd>
    </div>
  );
}
