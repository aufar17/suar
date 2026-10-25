import Image from "next/image";

import logo from "@/public/logo.png";

/** Suar mark: a warning beacon inside a flame. Transparent background, so it works on both themes. */
export function LogoMark({ className }: { className?: string }) {
  // 32 px intrinsic size keeps the srcset at 1x/2x of the header size instead of the 512 px source.
  return <Image src={logo} alt="" aria-hidden="true" width={32} height={32} className={className} />;
}
