"use client";

import type { FormEvent } from "react";

import { days, inputClass } from "../../constants/staffUi.constants";
import { FormInput } from "./StaffFormControls";

export function AddStaffCard({
  isCreating,
  onCancel,
  onSubmit,
}: {
  isCreating: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
      id="add-staff"
      onSubmit={onSubmit}
    >
      <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <h2 className="text-2xl font-medium" id="add-staff-title">
          Add New User
        </h2>
      </header>

      <div className="px-5 py-5">
        <p className="mb-5 text-sm text-txt-secondary">
          The new staff member must verify their email before login.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
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
            className="md:col-span-2"
          />
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="text-xs font-bold">Working days</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {days.map((day) => (
                <label
                  className="flex items-center gap-2 rounded-sm border border-background-secondary px-3 py-2 text-xs font-semibold"
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
            className="md:col-span-2"
          />
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
            Bio
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              disabled={isCreating}
              maxLength={1000}
              name="bio"
            />
          </label>
        </div>
      </div>

      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating}
          type="submit"
        >
          {isCreating ? "Creating..." : "Create staff member"}
        </button>
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating}
          onClick={onCancel}
          type="button"
        >
          Back to staff
        </button>
      </footer>
    </form>
  );
}

