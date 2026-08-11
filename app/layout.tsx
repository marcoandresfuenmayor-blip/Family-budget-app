import type { Metadata } from "next";
import "./globals.css";
import { HouseholdProvider } from "@/lib/HouseholdContext";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Finanzas Familiares",
  description: "Control de gastos e ingresos familiares",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <HouseholdProvider>
          <Nav />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </HouseholdProvider>
      </body>
    </html>
  );
}
