import type { Metadata } from "next";
import { CheckInboxView } from "./check-inbox-view";

export const metadata: Metadata = {
  title: "Check your inbox",
  description: "Confirm your email address to activate your Link Hub account.",
};

export default function CheckInboxPage() {
  return <CheckInboxView />;
}
