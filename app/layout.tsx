import type { Metadata } from "next";
import "./globals.css";
import { HouseholdProvider } from "@/lib/HouseholdContext";
import AppShell from "@/components/Nav";

export const metadata: Metadata = {
  title: "Finanzas Familiares",
  description: "Control de gastos e ingresos familiares",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <HouseholdProvider>
          <AppShell>{children}</AppShell>
        </HouseholdProvider>
      </body>
    </html>
  );
}
