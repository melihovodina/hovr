import { Logo, ThemeToggle } from "@/components/brand";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center gap-4">
      <Logo />
      <ThemeToggle />
    </main>
  );
}
