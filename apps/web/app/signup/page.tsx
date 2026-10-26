import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Claim your Link Hub page and start building your profile.",
};

export default function SignupPage() {
  if (process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "true") {
    redirect("/login");
  }
  return <SignupForm />;
}
