"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/data-display/LoadingState";

import type { StaffDayOfWeek, StaffMember, UpdateStaffAvailabilityPayload, UpdateStaffPayload } from "../../api/staffApi";
import { days, inputClass } from "../../constants/staffUi.constants";
import type { ResultToast } from "../../types/staffUi.types";
import { availabilitySummary, getErrorMessage, statusLabel, statusTone } from "../../utils/staffFormatters";
import { FormInput } from "./StaffFormControls";

export function StaffProfile({
  initiallyEditing,
  member,
  onClose,
  onUpdated,
  showToast,
  getStaff,
  updateStaff,
  updateAvailability,
}: {
  initiallyEditing: boolean;
  member: StaffMember;
  onClose: () => void;
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
}) {
  const [staff, setStaff] = useState(member);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <section
      aria-labelledby="profile-title"
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
    >
      <article className="relative">
        <button
          aria-label="Close profile"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-sm bg-background-secondary text-txt-secondary"
          onClick={onClose}
          type="button"
        >
          X
        </button>
        {isLoading ? (
          <LoadingState className="p-6" label="Loading complete staff details" />
        ) : isEditing ? (
          <StaffEditForm
            member={staff}
            isSaving={isSaving}
            onCancel={() => setIsEditing(false)}
            onSubmit={saveProfile}
          />
        ) : (
          <div className="p-6">
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
          </div>
        )}
      </article>
    </section>
  );
}

export function ProfileDetail({
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

export function StaffEditForm({
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
      <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <h3 className="text-2xl font-medium">Edit {member.display_name}</h3>
      </header>
      <div className="px-5 py-5">
        <p className="mb-5 text-sm text-txt-secondary">
          Email and portal role cannot be changed through this form.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
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
      </div>
      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </footer>
    </form>
  );
}
