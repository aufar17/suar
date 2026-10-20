import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiShowcase } from "./showcase";

export const metadata: Metadata = {
  title: "UI kit (internal)",
  robots: { index: false, follow: false },
};

/**
 * Internal page listing design tokens and components. Not linked from the navigation,
 * and only available in development (`pnpm dev`); production builds answer 404.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiShowcase />;
}
