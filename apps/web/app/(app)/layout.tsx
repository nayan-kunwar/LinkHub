import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { DashboardShell } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
