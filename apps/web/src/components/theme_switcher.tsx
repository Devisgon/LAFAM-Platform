"use client";

export function ThemeSwitcher() {
  function toggleTheme() {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }

  return (
    <button
      aria-label="Toggle light and dark theme"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-background-secondary bg-background text-text-secondary hover:text-primary"
      onClick={toggleTheme}
      title="Toggle light and dark theme"
      type="button"
    >
      <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
