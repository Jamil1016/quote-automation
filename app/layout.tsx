import type { Metadata } from "next";
import { Spline_Sans, Spline_Sans_Mono, Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Example Co theme typeface (exact match to the Example Co Design System).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const splineSans = Spline_Sans({
  variable: "--font-spline-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Quote Automation | Example Co",
    template: "%s | Quote Automation",
  },
  description: "Quote Automation, Example Co internal invoicing and quotation tool.",
  icons: { icon: "/favicon.ico" },
  metadataBase: new URL("https://quote-automation-demo.vercel.app"),
  // Link previews: /og.png is a static file, so the auth proxy never sees it.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Quote Automation demo",
    title: "Quote Automation: review queue, batch PDFs and email drafts (live demo)",
    description: "Review a quoting worklist, generate PDFs in bulk and stage email drafts. Invented data; nothing is sent.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Quotation queue in the demo" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${splineSans.variable} ${splineMono.variable} ${fraunces.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
