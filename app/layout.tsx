import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "TVC Volleyball Championship · Live Scoreboard",
  description: "Live scores, schedule and team statistics for the TVC Volleyball Championship.",
  openGraph: {
    title: "TVC Volleyball Championship · Live Scoreboard",
    description: "Live scores, schedule and team statistics.",
    siteName: "TVC Volleyball",
    type: "website",
  },
};
export const viewport: Viewport = { themeColor: "#06151f" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
