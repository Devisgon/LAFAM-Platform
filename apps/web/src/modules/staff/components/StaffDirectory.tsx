"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { ConfirmationCard } from "@/components/feedback/ConfirmationCard";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

import { useStaff } from "../hooks/useStaff";
import type { StaffMember } from "../api/staffApi";
import {
  ADD_STAFF_HASH,
  pageSizeOptions,
} from "../constants/staffUi.constants";
import type { ResultToast, StaffTableAction } from "../types/staffUi.types";
import {
  buildCreatePayload,
  getErrorMessage,
  isActiveStaff,
  statusLabel,
  usernameFromEmail,
} from "../utils/staffFormatters";
import { AddStaffCard } from "./staff-management/AddStaffCard";
import { ConfirmationOverlay } from "./staff-management/StaffFormControls";
import { StaffProfile } from "./staff-management/StaffProfile";

type StaffDirectoryProps = {
  currentRole?: string | null;
};

function StaffStatusToggle({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <span
      aria-checked={checked}
      aria-label={label}
      className={`mx-auto inline-flex h-7 w-12 items-center rounded-full border border-background-secondary p-1 transition ${
        checked ? "bg-primary" : "bg-card-bg-secondary"
      }`}
      role="switch"
    >
      <span
        className={`size-5 rounded-full bg-card-bg-primary shadow-sm transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  );
}

export function StaffDirectory({ currentRole = null }: StaffDirectoryProps) {
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
  const [openStaffInEditMode, setOpenStaffInEditMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: StaffTableAction;
    member: StaffMember;
  } | null>(null);
  const [isActionSaving, setIsActionSaving] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateMode, setIsCreateMode] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.location.hash === ADD_STAFF_HASH,
  );
  const canManageStaff =
    currentRole === "admin" || currentRole === "super_admin";
  useEffect(() => {
    const syncCreateMode = () => {
      const shouldOpenCreateMode =
        canManageStaff && window.location.hash === ADD_STAFF_HASH;

      setIsCreateMode(shouldOpenCreateMode);

      if (!canManageStaff && window.location.hash === ADD_STAFF_HASH) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    };

    syncCreateMode();

    window.addEventListener("hashchange", syncCreateMode);
    return () => window.removeEventListener("hashchange", syncCreateMode);
  }, [canManageStaff]);

  const runStaffTableAction = async () => {
    if (!pendingAction || !canManageStaff) return;

    const { action, member } = pendingAction;
    setIsActionSaving(true);
    try {
      if (action === "delete") {
        await deleteStaff(member.id);
        setToast({
          message: `${member.display_name} was deleted.`,
          title: "Staff member deleted",
          tone: "success",
        });
      } else {
        const updated =
          action === "deactivate"
            ? await deactivateStaff(member.id)
            : await reactivateStaff(member.id);
        setToast({
          message: `${updated.display_name} was ${action === "deactivate" ? "deactivated" : "reactivated"}.`,
          title: "Staff status updated",
          tone: "success",
        });
      }
      setPendingAction(null);
    } catch (error: unknown) {
      setToast({
        message: getErrorMessage(error),
        title: "Staff action failed",
        tone: "error",
      });
    } finally {
      setIsActionSaving(false);
    }
  };

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
  const visibleEnd = Math.min(
    pageStart + pagedStaff.length,
    filteredStaff.length,
  );
  const isEditingStaffPage =
    canManageStaff && Boolean(selectedStaff && openStaffInEditMode);

  const createStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageStaff) {
      setToast({
        message: "You do not have permission to create staff members.",
        title: "Staff action blocked",
        tone: "error",
      });
      return;
    }

    const form = event.currentTarget;

    try {
      const createdStaff = await createStaffRequest(
        buildCreatePayload(new FormData(form)),
      );

      form.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setIsCreateMode(false);
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
        {isEditingStaffPage && selectedStaff ? (
          <StaffProfile
            initiallyEditing={openStaffInEditMode}
            member={selectedStaff}
            onClose={() => {
              setOpenStaffInEditMode(false);
              setSelectedStaff(null);
            }}
            onUpdated={setSelectedStaff}
            showToast={setToast}
            getStaff={getStaff}
            updateStaff={updateStaff}
            updateAvailability={updateAvailability}
          />
        ) : canManageStaff && isCreateMode ? (
          <AddStaffCard
            isCreating={isCreating}
            onCancel={() => {
              window.history.replaceState(null, "", window.location.pathname);
              setIsCreateMode(false);
            }}
            onSubmit={createStaff}
          />
        ) : (
          <>
            {canManageStaff ? (
              <section className="flex items-center justify-between gap-4 rounded-md bg-card-bg-primary px-5 py-5 shadow-lg shadow-slate-900/10">
                <h2 className="text-2xl font-medium">Add New User</h2>
                <button
                  className="min-h-12 rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => {
                    window.history.replaceState(null, "", ADD_STAFF_HASH);
                    setIsCreateMode(true);
                  }}
                  type="button"
                >
                  + Add staff
                </button>
              </section>
            ) : null}

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
                    className="mt-3 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-end">
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

                  <DataTable
                    bodyClassName=""
                    className="border"
                    columnHeaderClassName="border-r border-background-secondary px-1 py-2 align-bottom font-bold last:border-r-0"
                    columns={[
                      {
                        key: "active",
                        heading: (
                          <span className="flex min-h-12 items-end justify-between gap-2">
                            <span>Active/Inactive</span>
                          </span>
                        ),
                      },
                      {
                        key: "full-name",
                        heading: (
                          <span className="flex min-h-12 items-end justify-between gap-2">
                            <span>Full Name</span>
                          </span>
                        ),
                      },
                      {
                        key: "mobile",
                        heading: (
                          <span className="flex min-h-12 items-end justify-between gap-2">
                            <span>Mobile Number</span>
                          </span>
                        ),
                      },
                      {
                        key: "email",
                        heading: (
                          <span className="flex min-h-12 items-end justify-between gap-2">
                            <span>Email</span>
                          </span>
                        ),
                      },
                      {
                        key: "username",
                        heading: (
                          <span className="flex min-h-12 items-end justify-between gap-2">
                            <span>Username</span>
                          </span>
                        ),
                      },
                      {
                        key: "role",
                        heading: (
                          <span className="flex min-h-12 items-end justify-between gap-2">
                            <span>Role</span>
                          </span>
                        ),
                      },
                      ...(canManageStaff
                        ? [
                            {
                              key: "action",
                              heading: (
                                <span className="flex min-h-12 items-end justify-between gap-2">
                                  <span>Action</span>
                                </span>
                              ),
                            },
                          ]
                        : []),
                    ]}
                    emptyCellClassName="px-3 py-6 text-center text-txt-secondary"
                    emptyMessage="No staff members found."
                    headerRowClassName="border-b-2 text-txt-primary"
                    isEmpty={pagedStaff.length === 0}
                    minWidthClassName=""
                    wrapperClassName="overflow-x-auto px-5"
                  >
                    {pagedStaff.map((member) => (
                      <tr
                        className="border-b border-background-secondary bg-background-secondary last:border-0"
                        key={member.id}
                      >
                        <td className="border-r border-background-secondary px-1 py-3">
                          <StaffStatusToggle
                            checked={isActiveStaff(member)}
                            label={`${member.display_name} active status`}
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
                        <td className="border-r border-background-secondary px-1 py-3 capitalize">
                          {member.portal_role}
                        </td>
                        {canManageStaff ? (
                          <td className="px-1 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                aria-label={`Edit ${member.display_name}`}
                                className="flex size-9 items-center justify-center rounded-full bg-button-primary text-txt-primary transition hover:opacity-85"
                                onClick={() => {
                                  setOpenStaffInEditMode(true);
                                  setSelectedStaff(member);
                                }}
                                title="Edit"
                                type="button"
                              >
                                <Pencil
                                  aria-hidden="true"
                                  size={17}
                                  strokeWidth={2.4}
                                />
                              </button>
                              {member.staff_status === "deactivated" ? (
                                <button
                                  aria-label={`Activate ${member.display_name}`}
                                  className="flex size-9 items-center justify-center rounded-full border border-background-secondary bg-primary text-txt-primary transition hover:opacity-85"
                                  onClick={() =>
                                    setPendingAction({
                                      action: "reactivate",
                                      member,
                                    })
                                  }
                                  title="Activate"
                                  type="button"
                                >
                                  <UserCheck
                                    aria-hidden="true"
                                    size={18}
                                    strokeWidth={2.4}
                                  />
                                </button>
                              ) : (
                                <button
                                  aria-label={`Deactivate ${member.display_name}`}
                                  className="flex size-9 items-center justify-center rounded-full border border-background-secondary bg-warning text-txt-primary transition hover:opacity-85"
                                  onClick={() =>
                                    setPendingAction({
                                      action: "deactivate",
                                      member,
                                    })
                                  }
                                  title="Deactivate"
                                  type="button"
                                >
                                  <UserX
                                    aria-hidden="true"
                                    size={18}
                                    strokeWidth={2.4}
                                  />
                                </button>
                              )}
                              <button
                                aria-label={`Delete ${member.display_name}`}
                                className="flex size-9 items-center justify-center rounded-full border border-background-secondary bg-error text-txt-primary transition hover:opacity-85"
                                onClick={() =>
                                  setPendingAction({ action: "delete", member })
                                }
                                title="Delete"
                                type="button"
                              >
                                <Trash2
                                  aria-hidden="true"
                                  size={18}
                                  strokeWidth={2.4}
                                />
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </DataTable>

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
                      Showing {visibleStart} to {visibleEnd} of{" "}
                      {filteredStaff.length} entries
                    </p>

                    <nav
                      aria-label="Staff list pagination"
                      className="flex items-center"
                    >
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
                      <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-txt-primary">
                        {safeCurrentPage}
                      </span>
                      <button
                        className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={safeCurrentPage >= pageCount}
                        onClick={() =>
                          setCurrentPage(() =>
                            Math.min(pageCount, safeCurrentPage + 1),
                          )
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
          </>
        )}

        {selectedStaff && !openStaffInEditMode ? (
          <StaffProfile
            initiallyEditing={openStaffInEditMode}
            member={selectedStaff}
            onClose={() => {
              setOpenStaffInEditMode(false);
              setSelectedStaff(null);
            }}
            onUpdated={setSelectedStaff}
            showToast={setToast}
            getStaff={getStaff}
            updateStaff={updateStaff}
            updateAvailability={updateAvailability}
          />
        ) : null}
        {canManageStaff && pendingAction ? (
          <ConfirmationOverlay>
            <ConfirmationCard
              cancelLabel="Cancel"
              confirmLabel={`Yes, ${pendingAction.action === "reactivate" ? "activate" : pendingAction.action}`}
              description={`Are you sure you want to ${pendingAction.action === "reactivate" ? "activate" : pendingAction.action} ${pendingAction.member.display_name}?${pendingAction.action === "delete" ? " This soft-deletes the staff record." : ""}`}
              loading={isActionSaving}
              onCancel={() => setPendingAction(null)}
              onConfirm={() => void runStaffTableAction()}
              title={`${statusLabel(pendingAction.action === "reactivate" ? "activate" : pendingAction.action)} staff member?`}
              tone={
                pendingAction.action === "reactivate" ? "default" : "danger"
              }
            />
          </ConfirmationOverlay>
        ) : null}
      </section>
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
