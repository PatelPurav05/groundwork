import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter_Tight, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const ui = Inter_Tight({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "600"] });
const data = Geist_Mono({ variable: "--font-data", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Groundwork · find land the new housing laws opened",
  description:
    "Sift every parcel in Santa Ana for land California's housing laws opened up. Every check cites its dataset. Prototype, not legal advice.",
};

export const viewport: Viewport = { themeColor: "#FBFBF8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${data.variable} h-full`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
