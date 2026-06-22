import { ProfileSettings } from "@/components/profile_settings";

export function UserSettings() {
  return (
    <section aria-labelledby="profile-settings-title" className="min-w-0">
      <div className="mb-6">
        <h2
          className="text-2xl font-bold text-txt-primary"
          id="profile-settings-title"
        >
          User profile
        </h2>
        <p className="mt-1 text-sm text-txt-secondary">
          Manage your personal details, password, and active sessions.
        </p>
      </div>
      <ProfileSettings />
    </section>
  );
}
