"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  ux_mode?: "popup" | "redirect";
  context?: "signin" | "signup" | "use";
}

interface GoogleButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
}

interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  disableAutoSelect: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google sign-in script failed to load.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Google sign-in script failed to load.")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
}

export interface GoogleButtonProps {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  text?: "signin_with" | "continue_with";
  className?: string;
}

/**
 * Renders Google Identity Services' own button. The component is inert when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset, so the feature can ship dark and be
 * enabled with environment variables only.
 */
export function GoogleButton({
  onCredential,
  disabled = false,
  text = "signin_with",
  className,
}: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [failed, setFailed] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelled = false;
    let initialized = false;
    let lastWidth = 0;
    const container = containerRef.current;

    const render = () => {
      if (cancelled || !containerRef.current) return;
      const accountsId = window.google?.accounts?.id;
      if (!accountsId) return;

      const width = Math.max(
        200,
        Math.min(400, Math.round(containerRef.current.clientWidth || 320)),
      );
      if (width === lastWidth) return;
      lastWidth = width;

      if (!initialized) {
        accountsId.initialize({
          client_id: clientId,
          callback: (response) => {
            if (cancelled || !response.credential) return;
            callbackRef.current(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: "popup",
          context: text === "continue_with" ? "use" : "signin",
        });
        initialized = true;
      }

      container.replaceChildren();
      accountsId.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        shape: "rectangular",
        logo_alignment: "center",
        width,
      });
    };

    setFailed(false);
    void loadGoogleScript()
      .then(() => {
        if (!cancelled) render();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    const observer = new ResizeObserver(() => render());
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [clientId, text]);

  if (!clientId) return null;

  if (failed) {
    return (
      <p
        role="status"
        className={cn(
          "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center text-sm text-zinc-700",
          className,
        )}
      >
        Google sign-in is unavailable right now.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-10 w-full items-center justify-center overflow-hidden",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      aria-busy={disabled}
    />
  );
}
