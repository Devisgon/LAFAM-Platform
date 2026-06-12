import Image from "next/image";
import type { HTMLAttributes } from "react";

type Size = "sm" | "md" | "lg";
const cn = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  alt: string;
  name: string;
  size?: Size;
  src?: string;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function Avatar({ alt, className, name, size = "md", src, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-secondary font-bold text-primary",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-11",
        size === "lg" && "size-16 text-xl",
        className,
      )}
      title={name}
      {...props}
    >
      {src ? <Image alt={alt} className="size-full object-cover" height={96} src={src} unoptimized width={96} /> : <span aria-hidden="true">{initials(name)}</span>}
      {!src && <span className="sr-only">{alt}</span>}
    </span>
  );
}
