import type { Metadata } from "next";
import { getPublicProfile } from "@/lib/public-profile";
import { PublicProfile } from "./public-profile";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicProfile(username);

  if (!data) {
    return {
      title: "Page not found",
      description: "This Link Hub page isn't available.",
      robots: { index: false, follow: false },
    };
  }

  const { profile } = data;
  const description =
    profile.headline || profile.bio || `Links, projects and updates from @${profile.username}.`;
  const title = `${profile.displayName} (@${profile.username})`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/${profile.username}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const data = await getPublicProfile(username);
  return <PublicProfile username={username} data={data} />;
}
