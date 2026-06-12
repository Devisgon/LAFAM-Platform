"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfileSessions } from "@/hooks/useProfileSessions";
import type { ActiveSession } from "@/lib/profile-sessions";
import { Avatar } from "./reuseable_ui_components/avatar";
import { Badge } from "./reuseable_ui_components/badge";
import { Button } from "./reuseable_ui_components/button";
import { ConfirmationCard } from "./reuseable_ui_components/confirmation_card";
import { Input } from "./reuseable_ui_components/input";
import { LoadingState } from "./reuseable_ui_components/loading_state";
import { Toast } from "./reuseable_ui_components/toast";

type Confirmation =
  | { action: "revoke"; session: ActiveSession }
  | { action: "logout-current" | "logout-all" | "delete-account" };

type ResultToast = {
  title: string;
  message: string;
  tone: "success" | "error";
};

type IconName =
  | "camera"
  | "chevron"
  | "edit"
  | "key";

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ProfileSettings() {
  const { avatarUrl, user } = useAuth();
  const {
    sessions,
    total,
    isLoading,
    isSavingProfile,
    isUploadingAvatar,
    isChangingPassword,
    isMutatingSessions,
    error,
    loadSessions,
    updateProfile,
    uploadAvatar,
    changePassword,
    deleteAccount,
    revokeSession,
    logoutCurrent,
    logoutAll,
  } = useProfileSessions();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);

  useEffect(() => {
    const sync = window.setTimeout(() => {
      setFullName(user?.full_name ?? "");
      setPhone(user?.phone ?? "");
      setTimezone(user?.timezone ?? "");
    }, 0);

    return () => window.clearTimeout(sync);
  }, [user]);

  const resetProfileForm = () => {
    setFullName(user?.full_name ?? "");
    setPhone(user?.phone ?? "");
    setTimezone(user?.timezone ?? "");
  };

  const closePasswordForm = () => {
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setIsPasswordOpen(false);
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        phone: phone.replaceAll(" ", "").trim() || null,
        timezone: timezone.trim() || null,
      });
      setIsEditing(false);
      setToast({
        title: "Profile updated",
        message: "Your account details were saved.",
        tone: "success",
      });
    } catch (requestError: unknown) {
      setToast({
        title: "Profile update failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Your profile could not be updated.",
        tone: "error",
      });
    }
  };

  const submitAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setToast({
        title: "Avatar not uploaded",
        message: "Choose a JPEG, PNG, or WebP image.",
        tone: "error",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setToast({
        title: "Avatar not uploaded",
        message: "The avatar must be 2 MB or smaller.",
        tone: "error",
      });
      return;
    }

    try {
      await uploadAvatar(file);
      setToast({
        title: "Avatar updated",
        message: "Your new profile photo is now visible across the portal.",
        tone: "success",
      });
    } catch (requestError: unknown) {
      setToast({
        title: "Avatar upload failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Your profile photo could not be uploaded.",
        tone: "error",
      });
    }
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setToast({
        title: "Password not changed",
        message: "The new password and confirmation do not match.",
        tone: "error",
      });
      return;
    }

    try {
      await changePassword({
        current_password: currentPassword,
        password,
        confirm_password: confirmPassword,
      });
      window.location.assign("/");
    } catch (requestError: unknown) {
      setToast({
        title: "Password change failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Your password could not be changed.",
        tone: "error",
      });
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmation) return;

    try {
      if (confirmation.action === "revoke") {
        await revokeSession(confirmation.session.id);
        setConfirmation(null);
        setToast({
          title: "Session revoked",
          message: `${confirmation.session.device_name ?? "The selected device"} was signed out.`,
          tone: "success",
        });
        return;
      }

      if (confirmation.action === "logout-all") {
        await logoutAll();
      } else if (confirmation.action === "delete-account") {
        await deleteAccount();
      } else {
        await logoutCurrent();
      }

      window.location.assign("/");
    } catch (requestError: unknown) {
      setConfirmation(null);
      setToast({
        title: "Session action failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The session action could not be completed.",
        tone: "error",
      });
    }
  };

  const confirmationCopy = getConfirmationCopy(confirmation);

  return (
    <>
      <div className="grid gap-6">
        <section className="rounded-2xl bg-card-bg-primary p-5 shadow-[0_10px_35px_rgb(15_23_42/0.06)] sm:p-7">
          <header className="flex flex-wrap items-center gap-4 border-b border-background-secondary pb-6">
            <div className="relative shrink-0 rounded-full shadow-sm">
              <Avatar
                alt={`${user?.full_name ?? "Account"} profile photo`}
                className="size-20 border-2 border-card-bg-primary text-xl"
                name={user?.full_name ?? user?.email ?? "Account"}
                size="lg"
                src={avatarUrl ?? undefined}
              />
              <label
                className="absolute -bottom-0.5 -right-0.5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-card-bg-primary bg-button-primary text-white shadow-md transition-opacity hover:opacity-90"
                title="Change profile photo"
              >
                <Icon name="camera" />
                <span className="sr-only">Change profile photo</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isUploadingAvatar || user?.is_guest}
                  onChange={(event) => void submitAvatar(event)}
                  type="file"
                />
              </label>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-xl font-bold text-text-primary">
                  {user?.full_name ?? "Your profile"}
                </h2>
                <Badge
                  tone={user?.status === "active" ? "success" : "warning"}
                >
                  {label(user?.status ?? "unknown")}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-text-secondary">
                {user?.email ?? "No email address"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
                <Icon name="camera" />
                {isUploadingAvatar ? "Uploading..." : "Change photo"}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isUploadingAvatar || user?.is_guest}
                  onChange={(event) => void submitAvatar(event)}
                  type="file"
                />
              </label>
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  size="sm"
                  variant="outline"
                >
                  <Icon name="edit" />
                  Edit profile
                </Button>
              ) : null}
            </div>
          </header>

          <form
            className="grid gap-5 pt-6 md:grid-cols-2"
            onSubmit={submitProfile}
          >
            <Input
              autoComplete="name"
              className="bg-background-primary"
              disabled={!isEditing}
              label="Full name"
              name="full_name"
              onChange={(event) => setFullName(event.target.value)}
              value={fullName}
            />
            <Input
              autoComplete="tel"
              className="bg-background-primary"
              disabled={!isEditing}
              label="Phone number"
              name="phone"
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
            <Input
              className="bg-background-primary"
              disabled={!isEditing}
              label="Timezone"
              name="timezone"
              onChange={(event) => setTimezone(event.target.value)}
              value={timezone}
            />
            <Input
              className="bg-background-primary"
              disabled
              label="Email address"
              name="email"
              type="email"
              value={user?.email ?? ""}
            />
            {isEditing ? (
              <div className="flex justify-end gap-3 md:col-span-2">
                <Button
                  disabled={isSavingProfile}
                  onClick={() => {
                    resetProfileForm();
                    setIsEditing(false);
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button loading={isSavingProfile} type="submit">
                  Save changes
                </Button>
              </div>
            ) : null}
          </form>
        </section>

        <section className="rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
          <button
            aria-expanded={isPasswordOpen}
            className="flex w-full items-center gap-4 p-5 text-left sm:p-6"
            disabled={user?.is_guest}
            onClick={() => setIsPasswordOpen((current) => !current)}
            type="button"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon name="key" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-base text-text-primary">
                Change password
              </strong>
              <span className="mt-0.5 block text-sm text-text-secondary">
                Update your password and sign out other active sessions.
              </span>
            </span>
            <span
              className={`text-text-secondary transition-transform ${isPasswordOpen ? "rotate-180" : ""}`}
            >
              <Icon name="chevron" />
            </span>
          </button>

          {isPasswordOpen ? (
            <form
              className="grid gap-4 border-t border-background-secondary bg-card-bg-secondary p-5 sm:p-6 md:grid-cols-3"
              onSubmit={submitPassword}
            >
              <Input
                autoComplete="current-password"
                label="Current password"
                name="current_password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
              <Input
                autoComplete="new-password"
                hint="Use at least 8 characters."
                label="New password"
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <Input
                autoComplete="new-password"
                label="Confirm new password"
                minLength={8}
                name="confirm_password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
              <div className="flex flex-wrap gap-3 md:col-span-3">
                <Button loading={isChangingPassword} type="submit">
                  Update password
                </Button>
                <Button
                  disabled={isChangingPassword}
                  onClick={closePasswordForm}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-background-secondary p-5 sm:p-6">
            <div>
              <h3 className="font-bold text-text-primary">Active sessions</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {total} device session{total === 1 ? "" : "s"} can access this
                account.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setConfirmation({ action: "logout-current" })}
                size="sm"
                variant="outline"
              >
                Logout
              </Button>
              <Button
                onClick={() => setConfirmation({ action: "logout-all" })}
                size="sm"
                variant="danger"
              >
                Logout all
              </Button>
            </div>
          </header>

          {isLoading ? (
            <LoadingState className="p-5" label="Loading active sessions" />
          ) : error ? (
            <div className="p-5">
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
              <Button
                className="mt-3"
                onClick={() => void loadSessions().catch(() => undefined)}
                size="sm"
              >
                Try again
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <p className="p-5 text-sm text-text-secondary">
              No active sessions were returned.
            </p>
          ) : (
            <ul className="divide-y divide-background-secondary">
              {sessions.map((session) => (
                <li
                  className="flex flex-wrap items-start justify-between gap-4 p-5 sm:px-6"
                  key={session.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-text-primary">
                        {session.device_name ?? "Unknown device"}
                      </strong>
                      {session.is_current ? (
                        <Badge tone="success">Current session</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 break-words text-xs text-text-secondary">
                      {session.user_agent ?? session.type}
                    </p>
                    <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs text-text-secondary sm:grid-cols-2">
                      <SessionDetail
                        label="IP address"
                        value={session.ip_address}
                      />
                      <SessionDetail
                        label="Last active"
                        value={formatDate(session.last_seen_at)}
                      />
                      <SessionDetail
                        label="Signed in"
                        value={formatDate(session.created_at)}
                      />
                      <SessionDetail
                        label="Expires"
                        value={formatDate(session.expires_at)}
                      />
                    </dl>
                  </div>
                  {!session.is_current ? (
                    <Button
                      onClick={() =>
                        setConfirmation({ action: "revoke", session })
                      }
                      size="sm"
                      variant="danger"
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-error/30 bg-error/5 p-5 sm:p-6">
          <div>
            <h3 className="font-bold text-error">Delete account</h3>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Permanently disable your account and revoke every active session.
            </p>
          </div>
          <Button
            disabled={user?.is_guest}
            onClick={() => setConfirmation({ action: "delete-account" })}
            size="sm"
            variant="danger"
          >
            Delete my account
          </Button>
        </section>
      </div>

      {confirmation && confirmationCopy ? (
        <section
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
        >
          <ConfirmationCard
            confirmLabel={confirmationCopy.confirmLabel}
            description={confirmationCopy.description}
            loading={isMutatingSessions}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => void runConfirmedAction()}
            title={confirmationCopy.title}
            tone="danger"
          />
        </section>
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
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

function SessionDetail({
  label: detailLabel,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="font-bold text-text-primary">{detailLabel}</dt>
      <dd className="mt-0.5">{value ?? "Not available"}</dd>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    camera: (
      <>
        <path d="M14.5 5.5 13.4 4H8.6L7.5 5.5H5A2 2 0 0 0 3 7.5v8A2 2 0 0 0 5 17.5h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2.5Z" />
        <circle cx="11" cy="11.5" r="3" />
      </>
    ),
    chevron: <path d="m6 9 5 5 5-5" />,
    edit: (
      <>
        <path d="M13.5 5.5 16 8" />
        <path d="m4 16 .8-3.3L14.9 2.6a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2L7.3 15.2 4 16Z" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="11" r="4" />
        <path d="M12 11h7m-2 0v3m-3-3v2" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 22 22"
    >
      {paths[name]}
    </svg>
  );
}

function getConfirmationCopy(confirmation: Confirmation | null) {
  if (!confirmation) return null;

  if (confirmation.action === "revoke") {
    return {
      title: "Revoke this session?",
      description: `${confirmation.session.device_name ?? "This device"} will be signed out and must authenticate again.`,
      confirmLabel: "Yes, revoke session",
    };
  }

  if (confirmation.action === "logout-all") {
    return {
      title: "Logout all sessions?",
      description:
        "Every active device, including this one, will be signed out of your account.",
      confirmLabel: "Yes, logout all",
    };
  }

  if (confirmation.action === "delete-account") {
    return {
      title: "Delete your account?",
      description:
        "Your account will be soft-deleted and every active session will be revoked. This action cannot be undone from the portal.",
      confirmLabel: "Yes, delete my account",
    };
  }

  return {
    title: "Logout current session?",
    description: "You will be signed out of this device.",
    confirmLabel: "Yes, logout",
  };
}
