import type { Metadata } from "next";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = {
  title: "Profile",
  description: "Edit your public Link Hub identity, social links and publishing state.",
};

export default function ProfilePage() {
  return <ProfileEditor />;
}
