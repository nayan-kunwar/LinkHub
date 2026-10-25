import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your Link Hub account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
