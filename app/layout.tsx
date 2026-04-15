import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "RetailCRM Orders Dashboard",
  description: "Production-ready dashboard for RetailCRM orders stored in Supabase."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-mist font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
