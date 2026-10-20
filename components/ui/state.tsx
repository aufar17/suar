import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Empty result: an icon, what happened, and what the user can do next. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center", className)}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="max-w-sm">
        <p className="font-medium">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Failed load: a plain-language message and a retry. `retry` is rendered as given
 * (a Button in client components, a link elsewhere) so this stays server-renderable.
 */
export function ErrorState({
  title = "Data tidak dapat dimuat",
  description = "Periksa koneksi Anda, lalu coba lagi. Jika masalah berlanjut, data mungkin sedang diperbarui.",
  retry,
  detail,
  className,
}: {
  title?: string;
  description?: ReactNode;
  retry?: ReactNode;
  /** Technical detail such as an error code, shown small. */
  detail?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <div className="max-w-md">
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {detail ? <p className="mt-2 font-mono text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      {retry}
    </div>
  );
}
