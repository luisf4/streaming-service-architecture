import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata = {
  title: "Video Streaming",
  description: "Upload and watch videos processed by the streaming pipeline",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
