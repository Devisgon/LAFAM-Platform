"use client";

import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown, FileSpreadsheet, Pencil } from "lucide-react";
import { Avatar } from "./reuseable_ui_components/avatar";
import { Badge } from "./reuseable_ui_components/badge";
import { ConfirmationCard } from "./reuseable_ui_components/confirmation_card";
import { CreateActionBar } from "./reuseable_ui_components/create_action_bar";
import { LoadingState } from "./reuseable_ui_components/loading_state";
import { Toast } from "./reuseable_ui_components/toast";
import { useStaff } from "@/hooks/useStaff";
import {
  type CreateStaffPayload,
  type StaffDayOfWeek,
  type StaffMember,
  type StaffStatus,
  type UpdateStaffAvailabilityPayload,
  type UpdateStaffPayload,
} from "@/lib/staff";

export type { StaffMember } from "@/lib/staff";

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const inputClass =
  "min-h-10 w-full rounded-lg border border-background-secondary bg-background px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

const pageSizeOptions = [10, 25, 50];

const days: Array<{ label: string; short: string; value: StaffDayOfWeek }> = [
  { label: "Sunday", short: "Sun", value: 0 },
  { label: "Monday", short: "Mon", value: 1 },
  { label: "Tuesday", short: "Tue", value: 2 },
  { label: "Wednesday", short: "Wed", value: 3 },
  { label: "Thursday", short: "Thu", value: 4 },
  { label: "Friday", short: "Fri", value: 5 },
  { label: "Saturday", short: "Sat", value: 6 },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

function statusLabel(status: string): string {
  return status
    .replace("_", " ")
    .replace(/^\w/, (value) => value.toUpperCase());
}

function statusTone(status: StaffStatus): "success" | "warning" | "error" {
  if (status === "available") return "success";
  if (status === "deactivated" || status === "deleted") return "error";
  return "warning";
}

function isActiveStaff(member: StaffMember): boolean {
  return member.staff_status !== "deactivated" && member.staff_status !== "deleted";
}

function usernameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}

function availabilitySummary(member: StaffMember): {
  days: string;
  time: string;
} {
  const activeRules = member.availability.filter((rule) => rule.is_available);

  if (activeRules.length === 0) {
    return { days: "No working days", time: "Unavailable" };
  }

  return {
    days: activeRules
      .map(
        (rule) =>
          days.find((day) => day.value === rule.day_of_week)?.short ?? "?",
      )
      .join(", "),
    time: `${activeRules[0].start_time} - ${activeRules[0].end_time}`,
  };
}

function buildCreatePayload(formData: FormData): CreateStaffPayload {
  const workingDays = formData
    .getAll("working_days")
    .map((value) => Number(value))
    .filter((value): value is StaffDayOfWeek =>
      days.some((day) => day.value === value),
    );

  if (workingDays.length === 0) {
    throw new Error("Select at least one working day.");
  }

  const password = String(formData.get("password"));
  const confirmPassword = String(formData.get("confirm_password"));

  if (password !== confirmPassword) {
    throw new Error("Password and confirmation do not match.");
  }

  const phone = String(formData.get("phone")).replace(/\s+/g, "");
  const specialties = String(formData.get("specialties"))
    .split(",")
    .map((specialty) => specialty.trim())
    .filter(Boolean);

  return {
    display_name: String(formData.get("display_name")).trim(),
    email: String(formData.get("email")).trim().toLowerCase(),
    ...(phone ? { phone } : {}),
    password,
    confirm_password: confirmPassword,
    address: String(formData.get("address")).trim(),
    portal_role:
      formData.get("portal_role") === "trainer" ? "trainer" : "trainer",
    post_title: String(formData.get("post_title")).trim(),
    working_days: workingDays,
    start_time: String(formData.get("start_time")),
    end_time: String(formData.get("end_time")),
    ...(specialties.length > 0 ? { specialties } : {}),
    bio: String(formData.get("bio")).trim(),
    status:
      formData.get("status") === "unavailable"
        ? "unavailable"
        : formData.get("status") === "on_leave"
          ? "on_leave"
          : "available",
  };
}

export function StaffDirectory() {
  const {
    staff,
    isLoading,
    isCreating,
    error: loadError,
    loadStaff,
    createStaff: createStaffRequest,
    getStaff,
    updateStaff,
    updateAvailability,
    deactivateStaff,
    reactivateStaff,
    deleteStaff,
  } = useStaff();
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return staff;

    return staff.filter((member) =>
      [
        member.display_name,
        member.phone ?? "",
        member.email,
        usernameFromEmail(member.email),
        member.portal_role,
        member.post_title,
        member.staff_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, staff]);

  const pageCount = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pagedStaff = filteredStaff.slice(pageStart, pageStart + pageSize);
  const visibleStart = filteredStaff.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + pagedStaff.length, filteredStaff.length);

  const createStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const createdStaff = await createStaffRequest(
        buildCreatePayload(new FormData(form)),
      );

      form.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setToast({
        message: `${createdStaff.display_name} was created and must verify their email before login.`,
        title: "Staff member created",
        tone: "success",
      });
    } catch (error: unknown) {
      setToast({
        message: getErrorMessage(error),
        title: "Staff member not created",
        tone: "error",
      });
    }
  };

  return (
    <>
      <section
        className="grid px-8 gap-10  text-txt-primary"
        id="staff-directory-heading"
      >
        <CreateActionBar
          actionHref="#add-staff"
          actionLabel="Add New User"
          title="Add New User"
        />

        <section
          className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
          aria-label="Staff member list"
        >
          <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
            <h2 className="text-2xl font-medium">User List</h2>
          </header>

        {isLoading ? (
          <LoadingState className="p-6" label="Loading staff members" />
        ) : loadError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-error">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadStaff().catch(() => undefined)}
              className="mt-3 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
              <button
                aria-label="Export staff list"
                className="flex size-12 items-center justify-center rounded-md bg-black text-white transition hover:opacity-80"
                type="button"
              >
                <FileSpreadsheet aria-hidden="true" size={22} strokeWidth={2.4} />
              </button>

              <label className="md:w-[340px]">
                <span className="sr-only">Search staff members</span>
                <input
                  className="min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search..."
                  type="search"
                  value={search}
                />
              </label>
            </div>

            <div className="overflow-x-auto px-5">
              <table className="w-full  border text-left text-base">
                <thead>
                  <tr className="border-b-2  text-txt-primary">
                    {[
                      "Active/Inactive",
                      "Full Name",
                      "Mobile Number",
                      "Email",
                      "Username",
                      "Password",
                      "Role",
                      "Action",
                    ].map((heading) => (
                      <TableHeading heading={heading} key={heading} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedStaff.length > 0 ? (
                    pagedStaff.map((member) => (
                      <tr
                        className="border-b border-background-secondary bg-background-secondary last:border-0"
                        key={member.id}
                      >
                        <td className="border-r border-background-secondary px-1 py-3">
                          <input
                            aria-label={`${member.display_name} active status`}
                            checked={isActiveStaff(member)}
                            className="size-8 rounded-md border-background-secondary accent-primary"
                            readOnly
                            type="checkbox"
                          />
                        </td>
                        <td className="border-r border-background-secondary px-1 py-3 font-medium">
                          {member.display_name}
                        </td>
                        <td className="border-r border-background-secondary px-1 py-3">
                          {member.phone ?? "Not provided"}
                        </td>
                        <td className="border-r border-background-secondary px-1 py-3">
                          {member.email}
                        </td>
                        <td className="border-r border-background-secondary px-1 py-3">
                          {usernameFromEmail(member.email)}
                        </td>
                        <td className="border-r border-background-secondary px-1 py-3">
                          Protected
                        </td>
                        <td className="border-r border-background-secondary px-1 py-3 capitalize">
                          {member.portal_role}
                        </td>
                        <td className="px-1 py-3">
                          <button
                            aria-label={`Edit ${member.display_name}`}
                            className="mx-auto flex size-10 items-center justify-center rounded-full bg-button-primary text-white transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            onClick={() => setSelectedStaff(member)}
                            title="Edit"
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={21} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="bg-background-secondary">
                      <td
                        className="px-3 py-6 text-center text-txt-secondary"
                        colSpan={8}
                      >
                        No staff members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="flex flex-col gap-4 px-5 py-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
              <label className="flex items-center gap-4">
                <span className="relative inline-flex">
                  <select
                    aria-label="Records per page"
                    className="min-h-12 appearance-none rounded-sm border border-background-secondary bg-card-bg-primary px-4 pr-10 text-txt-primary outline-none focus:border-primary"
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    value={pageSize}
                  >
                    {pageSizeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                    size={16}
                  />
                </span>
                records per page
              </label>

              <p>
                Showing {visibleStart} to {visibleEnd} of {filteredStaff.length} entries
              </p>

              <nav aria-label="Staff list pagination" className="flex items-center">
                <button
                  className="min-h-11 rounded-l-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage(() => Math.max(1, safeCurrentPage - 1))
                  }
                  type="button"
                >
                  Previous
                </button>
                <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-white">
                  {safeCurrentPage}
                </span>
                <button
                  className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safeCurrentPage >= pageCount}
                  onClick={() =>
                    setCurrentPage(() => Math.min(pageCount, safeCurrentPage + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </nav>
            </footer>
          </>
        )}
        </section>
      </section>

      <section
        aria-labelledby="add-staff-title"
        aria-modal="true"
        className="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto bg-slate-950/60 p-4 target:flex"
        id="add-staff"
        role="dialog"
      >
        <a
          aria-label="Close add staff form"
          className="absolute inset-0 cursor-default"
          href="#staff-directory-heading"
        />
        <form
          onSubmit={createStaff}
          className="relative z-10 my-auto w-full max-w-3xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-txt-primary shadow-2xl"
        >
          <a
            aria-label="Close add staff form"
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-txt-secondary hover:text-txt-primary"
            href="#staff-directory-heading"
          >
            X
          </a>
          <h2 className="text-xl font-bold" id="add-staff-title">
            Add new staff member
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            The new staff member must verify their email before login.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Display name"
              name="display_name"
              autoComplete="name"
              maxLength={120}
              disabled={isCreating}
              required
            />
            <label className="grid gap-1.5 text-xs font-bold">
              Portal role
              <select
                className={inputClass}
                defaultValue="trainer"
                disabled={isCreating}
                name="portal_role"
              >
                <option value="trainer">Trainer</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <FormInput
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              disabled={isCreating}
              required
            />
            <FormInput
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+96550000000"
              maxLength={32}
              disabled={isCreating}
            />
            <FormInput
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              disabled={isCreating}
              required
            />
            <FormInput
              label="Confirm password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              disabled={isCreating}
              required
            />
            <FormInput
              label="Post title"
              name="post_title"
              placeholder="Pilates Trainer"
              maxLength={100}
              disabled={isCreating}
              required
            />
            <label className="grid gap-1.5 text-xs font-bold">
              Status
              <select
                className={inputClass}
                defaultValue="available"
                disabled={isCreating}
                name="status"
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
                <option value="on_leave">On leave</option>
              </select>
            </label>
            <FormInput
              label="Address"
              name="address"
              autoComplete="street-address"
              maxLength={500}
              disabled={isCreating}
              className="sm:col-span-2"
            />
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="text-xs font-bold">Working days</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {days.map((day) => (
                  <label
                    className="flex items-center gap-2 rounded-lg border border-background-secondary px-3 py-2 text-xs font-semibold"
                    key={day.value}
                  >
                    <input
                      type="checkbox"
                      name="working_days"
                      value={day.value}
                      disabled={isCreating}
                      className="accent-primary"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormInput
              label="Start time"
              name="start_time"
              type="time"
              disabled={isCreating}
              required
            />
            <FormInput
              label="End time"
              name="end_time"
              type="time"
              disabled={isCreating}
              required
            />
            <FormInput
              label="Specialties"
              name="specialties"
              placeholder="Reformer Pilates, Mat Pilates"
              disabled={isCreating}
              className="sm:col-span-2"
            />
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">
              Bio
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                disabled={isCreating}
                maxLength={1000}
                name="bio"
              />
            </label>
          </div>

          <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4">
            <a
              className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold hover:bg-background-secondary"
              href="#staff-directory-heading"
            >
              Cancel
            </a>
            <button
              className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "Creating..." : "Create staff member"}
            </button>
          </footer>
        </form>
      </section>

      {selectedStaff ? (
        <StaffProfile
          member={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onDeleted={() => setSelectedStaff(null)}
          onUpdated={setSelectedStaff}
          showToast={setToast}
          getStaff={getStaff}
          updateStaff={updateStaff}
          updateAvailability={updateAvailability}
          deactivateStaff={deactivateStaff}
          reactivateStaff={reactivateStaff}
          deleteStaff={deleteStaff}
        />
      ) : null}
      {toast ? (
        <div className="fixed right-4 top-4 z-[70]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}

function TableHeading({ heading }: { heading: string }) {
  return (
    <th className="border-r border-background-secondary px-1 py-2 align-bottom font-bold last:border-r-0">
      <span className="flex min-h-12 items-end justify-between gap-2">
        <span>{heading}</span>
      </span>
    </th>
  );
}

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

function FormInput({ className, label, ...props }: FormInputProps) {
  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {label}
      <input className={inputClass} {...props} />
    </label>
  );
}

function StaffProfile({
  member,
  onClose,
  onDeleted,
  onUpdated,
  showToast,
  getStaff,
  updateStaff,
  updateAvailability,
  deactivateStaff,
  reactivateStaff,
  deleteStaff,
}: {
  member: StaffMember;
  onClose: () => void;
  onDeleted: (staffId: string) => void;
  onUpdated: (member: StaffMember) => void;
  showToast: (toast: ResultToast) => void;
  getStaff: (staffId: string) => Promise<StaffMember>;
  updateStaff: (
    staffId: string,
    payload: UpdateStaffPayload,
  ) => Promise<StaffMember>;
  updateAvailability: (
    staffId: string,
    payload: UpdateStaffAvailabilityPayload,
  ) => Promise<StaffMember>;
  deactivateStaff: (staffId: string) => Promise<StaffMember>;
  reactivateStaff: (staffId: string) => Promise<StaffMember>;
  deleteStaff: (staffId: string) => Promise<unknown>;
}) {
  const [staff, setStaff] = useState(member);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "deactivate" | "reactivate" | "delete" | null
  >(null);

  useEffect(() => {
    const load = window.setTimeout(async () => {
      try {
        const detail = await getStaff(member.id);
        setStaff(detail);
        onUpdated(detail);
      } catch (error: unknown) {
        showToast({
          message: getErrorMessage(error),
          title: "Staff details not loaded",
          tone: "error",
        });
      } finally {
        setIsLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(load);
  }, [getStaff, member.id, onUpdated, showToast]);

  const availability = availabilitySummary(staff);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const formData = new FormData(event.currentTarget);
      const specialties = String(formData.get("specialties"))
        .split(",")
        .map((specialty) => specialty.trim())
        .filter(Boolean);
      const workingDays = formData
        .getAll("working_days")
        .map((value) => Number(value))
        .filter((value): value is StaffDayOfWeek =>
          days.some((day) => day.value === value),
        );

      if (workingDays.length === 0) {
        throw new Error("Select at least one working day.");
      }

      const profilePayload: UpdateStaffPayload = {
        display_name: String(formData.get("display_name")).trim(),
        phone: String(formData.get("phone")).replace(/\s+/g, "") || null,
        address: String(formData.get("address")).trim() || null,
        post_title: String(formData.get("post_title")).trim(),
        specialties,
        bio: String(formData.get("bio")).trim() || null,
        status:
          formData.get("status") === "unavailable"
            ? "unavailable"
            : formData.get("status") === "on_leave"
              ? "on_leave"
              : "available",
      };

      await updateStaff(staff.id, profilePayload);
      const updated = await updateAvailability(staff.id, {
        availability: workingDays.map((day) => ({
          day_of_week: day,
          start_time: String(formData.get("start_time")),
          end_time: String(formData.get("end_time")),
          is_available: true,
        })),
      });

      setStaff(updated);
      onUpdated(updated);
      setIsEditing(false);
      showToast({
        message: `${updated.display_name}'s profile and availability were updated.`,
        title: "Staff member updated",
        tone: "success",
      });
    } catch (error: unknown) {
      showToast({
        message: getErrorMessage(error),
        title: "Staff member not updated",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmation) return;

    setIsSaving(true);

    try {
      if (confirmation === "delete") {
        await deleteStaff(staff.id);
        onDeleted(staff.id);
        showToast({
          message: `${staff.display_name} was deleted.`,
          title: "Staff member deleted",
          tone: "success",
        });
        return;
      }

      const updated =
        confirmation === "deactivate"
          ? await deactivateStaff(staff.id)
          : await reactivateStaff(staff.id);

      setStaff(updated);
      onUpdated(updated);
      setConfirmation(null);
      showToast({
        message: `${updated.display_name} was ${confirmation === "deactivate" ? "deactivated" : "reactivated"}.`,
        title: "Staff status updated",
        tone: "success",
      });
    } catch (error: unknown) {
      setConfirmation(null);
      showToast({
        message: getErrorMessage(error),
        title: "Staff action failed",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (confirmation) {
    const actionLabel =
      confirmation === "delete"
        ? "delete"
        : confirmation === "deactivate"
          ? "deactivate"
          : "reactivate";

    return (
      <ConfirmationOverlay>
        <ConfirmationCard
          cancelLabel="Cancel"
          confirmLabel={`Yes, ${actionLabel}`}
          description={`Are you sure you want to ${actionLabel} ${staff.display_name}?${confirmation === "delete" ? " This soft-deletes the staff record." : ""}`}
          loading={isSaving}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void runConfirmedAction()}
          title={`${statusLabel(actionLabel)} staff member?`}
          tone={confirmation === "reactivate" ? "default" : "danger"}
        />
      </ConfirmationOverlay>
    );
  }

  return (
    <section
      aria-labelledby="profile-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <button
        aria-label="Close profile"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <article className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-txt-primary shadow-2xl">
        <button
          aria-label="Close profile"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-txt-secondary"
          onClick={onClose}
          type="button"
        >
          X
        </button>
        {isLoading ? (
          <LoadingState label="Loading complete staff details" />
        ) : isEditing ? (
          <StaffEditForm
            member={staff}
            isSaving={isSaving}
            onCancel={() => setIsEditing(false)}
            onSubmit={saveProfile}
          />
        ) : (
          <>
            <header className="flex items-start gap-4 pr-10">
              <Avatar
                alt={`${staff.display_name} avatar`}
                name={staff.display_name}
                size="lg"
              />
              <div>
                <h3 className="text-xl font-bold" id="profile-title">
                  {staff.display_name}
                </h3>
                <p className="mt-1 font-mono text-xs text-txt-secondary">
                  {staff.id}
                </p>
                <p className="mt-1 text-sm font-semibold text-txt-secondary">
                  {staff.post_title} | {staff.portal_role}
                </p>
                <Badge className="mt-3" tone={statusTone(staff.staff_status)}>
                  {statusLabel(staff.staff_status)}
                </Badge>
              </div>
            </header>
            <p className="mt-5 border-y border-background-secondary py-4 text-sm leading-6 text-txt-secondary">
              {staff.bio ?? "No bio provided."}
            </p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <ProfileDetail title="Contact">
                {staff.email}
                <span className="mt-1 block text-xs text-txt-secondary">
                  {staff.phone ?? "No phone provided"}
                </span>
              </ProfileDetail>
              <ProfileDetail title="Address">
                {staff.address ?? "No address provided"}
              </ProfileDetail>
              <ProfileDetail title="Available time">
                {availability.time}
                <span className="mt-1 block text-xs text-txt-secondary">
                  {availability.days}
                </span>
              </ProfileDetail>
              <ProfileDetail title="Auth status">
                {statusLabel(staff.auth_status)}
              </ProfileDetail>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-txt-secondary">
                  Specialties
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {staff.specialties.length > 0
                    ? staff.specialties.map((specialty) => (
                        <span
                          className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                          key={specialty}
                        >
                          {specialty}
                        </span>
                      ))
                    : "No specialties provided"}
                </dd>
              </div>
            </dl>
            <footer className="mt-6 flex flex-wrap justify-end gap-2 border-t border-background-secondary pt-4">
              <button
                className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Edit profile
              </button>
              {staff.staff_status === "deactivated" ? (
                <button
                  className="rounded-lg bg-success px-4 py-2 text-xs font-bold text-white"
                  onClick={() => setConfirmation("reactivate")}
                  type="button"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  className="rounded-lg bg-warning px-4 py-2 text-xs font-bold text-white"
                  onClick={() => setConfirmation("deactivate")}
                  type="button"
                >
                  Deactivate
                </button>
              )}
              <button
                className="rounded-lg bg-error px-4 py-2 text-xs font-bold text-white"
                onClick={() => setConfirmation("delete")}
                type="button"
              >
                Delete
              </button>
            </footer>
          </>
        )}
      </article>
    </section>
  );
}

function ProfileDetail({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-txt-secondary">
        {title}
      </dt>
      <dd className="mt-2 text-sm font-bold">{children}</dd>
    </div>
  );
}

function StaffEditForm({
  member,
  isSaving,
  onCancel,
  onSubmit,
}: {
  member: StaffMember;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeAvailability = member.availability.filter(
    (rule) => rule.is_available,
  );
  const firstAvailability = activeAvailability[0];
  const activeDays = new Set(
    activeAvailability.map((rule) => rule.day_of_week),
  );

  return (
    <form onSubmit={onSubmit}>
      <h3 className="text-xl font-bold">Edit {member.display_name}</h3>
      <p className="mt-1 text-sm text-txt-secondary">
        Email and portal role cannot be changed through this form.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormInput
          defaultValue={member.display_name}
          disabled={isSaving}
          label="Display name"
          maxLength={120}
          name="display_name"
          required
        />
        <FormInput
          defaultValue={member.phone ?? ""}
          disabled={isSaving}
          label="Phone"
          maxLength={32}
          name="phone"
          type="tel"
        />
        <FormInput
          defaultValue={member.post_title}
          disabled={isSaving}
          label="Post title"
          maxLength={100}
          name="post_title"
          required
        />
        <label className="grid gap-1.5 text-xs font-bold">
          Status
          <select
            className={inputClass}
            defaultValue={
              member.staff_status === "unavailable" ||
              member.staff_status === "on_leave"
                ? member.staff_status
                : "available"
            }
            disabled={isSaving}
            name="status"
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="on_leave">On leave</option>
          </select>
        </label>
        <FormInput
          className="sm:col-span-2"
          defaultValue={member.address ?? ""}
          disabled={isSaving}
          label="Address"
          maxLength={500}
          name="address"
        />
        <FormInput
          className="sm:col-span-2"
          defaultValue={member.specialties.join(", ")}
          disabled={isSaving}
          label="Specialties"
          name="specialties"
        />
        <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">
          Bio
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            defaultValue={member.bio ?? ""}
            disabled={isSaving}
            maxLength={1000}
            name="bio"
          />
        </label>
        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="text-xs font-bold">Working days</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {days.map((day) => (
              <label
                className="flex items-center gap-2 rounded-lg border border-background-secondary px-3 py-2 text-xs font-semibold"
                key={day.value}
              >
                <input
                  defaultChecked={activeDays.has(day.value)}
                  disabled={isSaving}
                  name="working_days"
                  type="checkbox"
                  value={day.value}
                  className="accent-primary"
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormInput
          defaultValue={firstAvailability?.start_time ?? "09:00"}
          disabled={isSaving}
          label="Start time"
          name="start_time"
          required
          type="time"
        />
        <FormInput
          defaultValue={firstAvailability?.end_time ?? "17:00"}
          disabled={isSaving}
          label="End time"
          name="end_time"
          required
          type="time"
        />
      </div>
      <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4">
        <button
          className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </footer>
    </form>
  );
}

function ConfirmationOverlay({ children }: { children: ReactNode }) {
  return (
    <section
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background p-4"
      role="dialog"
    >
      {children}
    </section>
  );
}
