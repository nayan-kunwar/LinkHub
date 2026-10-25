import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your links, analytics and Link Hub profile.",
};

export default function LoginPage() {
  return <LoginForm />;
}
