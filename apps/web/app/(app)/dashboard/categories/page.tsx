import type { Metadata } from "next";
import { CategoriesView } from "./categories-view";

export const metadata: Metadata = {
  title: "Categories",
  description: "Group the links on your Link Hub profile into categories.",
};

export default function CategoriesPage() {
  return <CategoriesView />;
}
