import { cn } from "cn";

// A grey block standing in for content that is still loading.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-skel motion-reduce:animate-none", className)} />;
}
