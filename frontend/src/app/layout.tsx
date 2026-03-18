import type { Metadata } from "next";
import "./globals.css";
import EyeMouseController from "@/components/EyeMouseController";
import CustomCursor from "@/components/CustomCursor";
import ScrollProgress from "@/components/ScrollProgress";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "SignSpeak — Hand Sign to Text",
  description:
    "Real-time hand gesture recognition for public speaking, meetings, and online calls. Type with your hands!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <LenisProvider>
          <ScrollProgress />
          <CustomCursor />
          <EyeMouseController />
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
