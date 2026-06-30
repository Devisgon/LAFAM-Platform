import type { IconName } from "../../types/settingsUi.types";

export function Icon({ name }: { name: IconName }) {
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
