import type { ReactNode } from "react";

export const metadata = {
  title: "Video Streaming",
  description: "Upload and watch videos processed by the streaming pipeline",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
