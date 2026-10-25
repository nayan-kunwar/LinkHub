import type { Metadata } from "next";
import { VerifyEmailView } from "./verify-email-view";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Confirm your email address to activate your Link Hub account.",
};

export default function VerifyEmailPage() {
  return <VerifyEmailView />;
}
