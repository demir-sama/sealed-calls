import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Ticker } from "@/components/Ticker";
import Link from "next/link";

const fraunces = localFont({
  variable: "--font-fraunces",
  display: "swap",
  src: [
    { path: "../assets/fonts/fraunces-latin-400-normal.woff", weight: "400", style: "normal" },
    { path: "../assets/fonts/fraunces-latin-400-italic.woff", weight: "400", style: "italic" },
    { path: "../assets/fonts/fraunces-latin-600-normal.woff", weight: "600", style: "normal" },
    { path: "../assets/fonts/fraunces-latin-600-italic.woff", weight: "600", style: "italic" },
    { path: "../assets/fonts/fraunces-latin-700-normal.woff", weight: "700", style: "normal" },
    { path: "../assets/fonts/fraunces-latin-700-italic.woff", weight: "700", style: "italic" },
  ],
});
const hanken = localFont({
  variable: "--font-hanken",
  display: "swap",
  src: [
    { path: "../assets/fonts/hanken-grotesk-latin-400-normal.woff", weight: "400" },
    { path: "../assets/fonts/hanken-grotesk-latin-600-normal.woff", weight: "600" },
  ],
});
const martian = localFont({
  variable: "--font-martian",
  display: "swap",
  src: [
    { path: "../assets/fonts/martian-mono-latin-400-normal.woff", weight: "400" },
    { path: "../assets/fonts/martian-mono-latin-500-normal.woff", weight: "500" },
    { path: "../assets/fonts/martian-mono-latin-700-normal.woff", weight: "700" },
  ],
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sealed-calls-sama-5806.vercel.app";
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Callwax — sealed predictions with a public track record", template: "%s · Callwax" },
  description: "Seal any prediction — a pundit's, a friend's, your own — into Walrus Memory with a Sui timestamp. Callwax resolves what it can check, scores every voice with Brier and calibration, and issues a receipt anyone can verify.",
  openGraph: { title: "Callwax — make every prediction keep its word", description: "Sealed on Walrus. Timestamped on Sui. Scored in public.", type: "website", siteName: "Callwax" },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = { themeColor: "#0b0907", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable} ${martian.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-ink">Skip to content</a>
        <Ticker />
        <Nav />
        <main id="main">{children}</main>
        <footer className="mt-32 border-t border-line">
          <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="display text-3xl italic">Call<span className="text-wax-hi">wax</span></div>
              <p className="mt-3 max-w-sm text-sm text-dim">A notary for predictions. Sealed in Walrus Memory, anchored to Sui, scored in public. Built for the Walrus × Tatum “Total Recall” hackathon.</p>
            </div>
            <div className="text-sm text-dim">
              <div className="eyebrow mb-3">Explore</div>
              <ul className="space-y-2"><li><Link href="/seal" className="hover:text-paper">Seal a call</Link></li><li><Link href="/voices" className="hover:text-paper">Voices & track records</Link></li><li><Link href="/verify" className="hover:text-paper">Verify a seal</Link></li></ul>
            </div>
            <div className="text-sm text-dim">
              <div className="eyebrow mb-3">Honest fine print</div>
              <p>Not financial advice. Sample voices are labelled. Sealed text is end-to-end stored on Walrus; resolutions are only as good as their named source.</p>
              <p className="mt-3"><Link href="/about" className="text-brass hover:underline">How it works & limits →</Link></p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
