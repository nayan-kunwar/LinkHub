import type { Metadata } from "next";
import { RestoreAccountView } from "./restore-account-view";

export const metadata: Metadata = {
  title: "Restore account",
  description: "Cancel a scheduled Link Hub account deletion during the 30-day grace period.",
};

export default function RestoreAccountPage() {
  return <RestoreAccountView />;
}
