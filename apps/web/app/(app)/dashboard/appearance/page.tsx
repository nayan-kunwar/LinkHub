import type { Metadata } from "next";
import { AppearanceView } from "./appearance-view";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Customize the theme, colors and layout of your public Link Hub profile.",
};

export default function AppearancePage() {
  return <AppearanceView />;
}
