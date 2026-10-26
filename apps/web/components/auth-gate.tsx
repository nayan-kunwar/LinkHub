"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Logo } from "./logo";
import { useAppData } from "@/lib/store";

function GateSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-16 items-center border-b border-line bg-white px-4 sm:px-5">
        <Logo className="text-lg" iconClassName="size-6" />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-violet-700" />
          <p className="mt-4 text-sm font-medium text-zinc-700">{label}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Client-side guard for /dashboard and /settings. The proxy already blocks
 * requests without a session cookie; this gate catches expired or revoked
 * sessions and pending-verification accounts after /auth/me resolves.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, loadError, refresh } = useAppData();
  const router = useRouter();
  const pathname = usePathname();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status === "anonymous") {
      const next =
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, status]);

  useEffect(() => {
    if (status === "pending") {
      router.replace("/check-inbox");
    }
  }, [router, status]);

  if (status === "authenticated") return <>{children}</>;

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16">
        <Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-lg font-bold text-zinc-900">Couldn&apos;t load your dashboard</h1>
          <p className="mt-2 text-sm text-zinc-700">
            {loadError ?? "The API is unavailable right now."}
          </p>
          <Button
            className="mt-5"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await refresh();
              setRetrying(false);
            }}
          >
            {retrying ? "Trying again…" : "Try again"}
          </Button>
        </Card>
      </div>
    );
  }

  if (status === "anonymous") return <GateSkeleton label="Redirecting to sign in…" />;
  if (status === "pending") return <GateSkeleton label="Redirecting to email verification…" />;

  return <GateSkeleton label="Loading your workspace…" />;
}
