import type { Metadata } from "next";
import { UiShowcase } from "./showcase";

export const metadata: Metadata = {
  title: "UI kit (internal)",
  robots: { index: false, follow: false },
};

/** Internal page listing design tokens and components. Not linked from the navigation. */
export default function DevUiPage() {
  return <UiShowcase />;
}
