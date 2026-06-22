import type { ReactNode } from "react";
import { GuestGuard } from "@/components/guards";
export default function AuthLayout({ children }: { children: ReactNode }) { return <GuestGuard>{children}</GuestGuard>; }

