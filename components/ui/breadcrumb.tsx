import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-0.5 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-0.5">
            {index > 0 ? <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" /> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex h-8 items-center rounded-md px-1.5 transition-colors hover:bg-muted hover:text-foreground pointer-coarse:h-11"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="px-1.5 font-medium text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
