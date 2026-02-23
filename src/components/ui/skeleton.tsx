import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-[#00F0FF]/[0.06] animate-shimmer", className)}
      style={{
        backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(0,255,212,0.08) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      }}
      {...props}
    />
  )
}

export { Skeleton }
