import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a secure link to reset your Link Hub password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
