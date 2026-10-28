"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";

const LINKS = [["/voices", "Voices"], ["/verify", "Verify"], ["/about", "How it works"]] as const;
export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3">
        <Wordmark />
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined} className={`rounded-full px-2.5 py-2 text-sm transition-colors sm:px-3 ${path.startsWith(href) ? "text-paper" : "text-dim hover:text-paper"} ${href !== "/voices" ? "hidden sm:block" : ""}`}>
              {label}
            </Link>
          ))}
          <Link href="/seal" className="btn btn-wax !min-h-[40px] shrink-0 whitespace-nowrap !px-4 !py-2 text-sm">Seal a call</Link>
        </nav>
      </div>
    </header>
  );
}
