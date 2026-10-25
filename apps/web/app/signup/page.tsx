import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Claim your Link Hub page and start building your profile.",
};

export default function SignupPage() {
  return <SignupForm />;
}
