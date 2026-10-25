import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { MockDataProvider } from "@/lib/store";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Link Hub — All your links in one place",
    template: "%s · Link Hub",
  },
  description:
    "Create a beautiful profile, share your work, and grow your audience. Link Hub is a fast, privacy-friendly link-in-bio page with built-in analytics.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Link Hub — All your links in one place",
    description: "A beautiful link-in-bio page with built-in analytics.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f5ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <MockDataProvider>{children}</MockDataProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            className: "toast-card",
            style: {
              background: "#1e1b4b",
              color: "#fff",
              border: "1px solid #312e81",
              borderRadius: "0.7rem",
              fontSize: "0.875rem",
              boxShadow: "0 12px 30px -12px rgba(30,27,75,.55)",
            },
          }}
        />
      </body>
    </html>
  );
}
