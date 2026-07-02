import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDeniedPanel } from "@/components/guards/AccessDeniedPanel";
import { Badge } from "@/components/ui/Badge";
import { hasAdminRouteAccess } from "@/lib/auth/admin-access";
import { getServerAuthContext } from "@/lib/auth/auth-context";
import { getServerSession } from "@/lib/auth/session";
import type { CustomerProfile } from "@/modules/customers";

type CustomerResponse = {
  data?: {
    customer?: CustomerProfile;
  };
  error?: {
    message?: string;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(
  status: CustomerProfile["auth_status"],
): "success" | "warning" | "error" | "neutral" {
  if (status === "active") return "success";
  if (status === "deactivated" || status === "deleted") return "error";
  if (status === "pending_email_verification") return "warning";
  return "neutral";
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  }).format(date);
}

async function readJsonSafe(response: Response): Promise<CustomerResponse> {
  try {
    return (await response.json()) as CustomerResponse;
  } catch {
    return {};
  }
}

async function getCustomer(customerId: string): Promise<CustomerProfile> {
  const session = await getServerSession();

  if (!session || !API_BASE_URL) {
    throw new Error("Customer detail cannot be loaded.");
  }

  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/admin/customers/${encodeURIComponent(customerId)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  );

  const payload = await readJsonSafe(response);

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok || !payload.data?.customer) {
    throw new Error(
      payload.error?.message ?? "Customer detail could not be loaded.",
    );
  }

  return payload.data.customer;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const context = await getServerAuthContext();

  if (!context || !hasAdminRouteAccess(context, "/settings/customers")) {
    return (
      <AccessDeniedPanel
        description="Customer details are not available for your account permissions."
        title="Customer detail locked"
      />
    );
  }

  const customer = await getCustomer(customerId);

  return (
    <section className="grid gap-5">
      <nav aria-label="Customer detail navigation">
        <Link
          className="inline-flex min-h-10 items-center rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-sm font-bold text-txt-primary shadow-sm transition hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/users"
        >
          Back to user management
        </Link>
      </nav>

      <article className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-txt-secondary">
                Customer Profile
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-txt-primary">
                {customer.full_name}
              </h2>
              <p className="mt-1 break-all text-sm text-txt-secondary">
                {customer.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(customer.auth_status)}>
                {label(customer.auth_status)}
              </Badge>
              <Badge tone="info">{label(customer.role)}</Badge>
            </div>
          </div>
        </header>

        <div className="grid gap-5 px-5 py-5 xl:grid-cols-2">
          <DetailPanel title="Identity">
            <DetailItem label="Customer profile id" value={customer.id} />
            <DetailItem label="App user id" value={customer.app_user_id} />
            <DetailItem label="Auth user id" value={customer.auth_user_id} />
            <DetailItem label="Civil ID" value={customer.civil_id} />
          </DetailPanel>

          <DetailPanel title="Contact">
            <DetailItem label="Full name" value={customer.full_name} />
            <DetailItem label="Email" value={customer.email} />
            <DetailItem label="Phone" value={customer.phone} />
            <DetailItem
              label="Timezone"
              value={customer.timezone ?? "Not provided"}
            />
          </DetailPanel>

          <DetailPanel title="Account">
            <DetailItem label="Role" value={label(customer.role)} />
            <DetailItem
              label="Authentication status"
              value={label(customer.auth_status)}
            />
            <DetailItem label="Guest account" value={customer.is_guest ? "Yes" : "No"} />
            <DetailItem
              label="Avatar path"
              value={customer.avatar_path ?? "Not provided"}
            />
          </DetailPanel>

          <DetailPanel title="Lifecycle">
            <DetailItem label="Created" value={formatDateTime(customer.created_at)} />
            <DetailItem label="Updated" value={formatDateTime(customer.updated_at)} />
            <DetailItem
              label="Deactivated"
              value={formatDateTime(customer.deactivated_at)}
            />
            <DetailItem label="Deleted" value={formatDateTime(customer.deleted_at)} />
          </DetailPanel>

          <DetailPanel className="xl:col-span-2" title="Admin Audit">
            <DetailItem
              label="Created by admin"
              value={customer.created_by_admin_id ?? "Not recorded"}
            />
            <DetailItem
              label="Updated by admin"
              value={customer.updated_by_admin_id ?? "Not recorded"}
            />
          </DetailPanel>
        </div>
      </article>
    </section>
  );
}

function DetailPanel({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={`rounded-sm border border-background-secondary bg-background-primary ${className ?? ""}`}
    >
      <h3 className="border-b border-background-secondary px-4 py-3 text-sm font-bold text-txt-primary">
        {title}
      </h3>
      <dl className="grid gap-0 divide-y divide-background-secondary">
        {children}
      </dl>
    </section>
  );
}

function DetailItem({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="break-all text-sm font-medium text-txt-primary">{value}</dd>
    </div>
  );
}
