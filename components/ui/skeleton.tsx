import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-foreground/[0.07] dark:bg-foreground/[0.09]", className)}
      {...props}
    />
  )
}

export { Skeleton }
