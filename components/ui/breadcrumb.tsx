import Link from "next/link";
import { ChevronRightIcon } from "./icons";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1">
            {index > 0 ? <ChevronRightIcon className="size-4" /> : null}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-11 items-center rounded px-1 hover:text-fg hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="px-1 font-medium text-fg">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
