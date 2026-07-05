import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          AISEO
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/onboarding" className={buttonVariants({ size: "sm" })}>
            Nouvelle solution
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SolutionNav({ id }: { id: string }) {
  const links = [
    { href: `/solutions/${id}`, label: "Vue d'ensemble" },
    { href: `/solutions/${id}/audit`, label: "Audit" },
    { href: `/solutions/${id}/recommendations`, label: "Recommandations" },
    { href: `/solutions/${id}/assets`, label: "Assets" },
    { href: `/solutions/${id}/monitoring`, label: "Monitoring" },
  ];
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
