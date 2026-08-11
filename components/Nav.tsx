"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHousehold } from "@/lib/HouseholdContext";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/gastos", label: "Gastos" },
  { href: "/ingresos", label: "Ingresos" },
  { href: "/tarjetas", label: "Tarjetas" },
  { href: "/categorias", label: "Categorías y límites" },
];

export default function Nav() {
  const pathname = usePathname();
  const { session, displayName, signOut } = useHousehold();

  if (!session) return null;

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="font-semibold text-brand-700">💰 Finanzas Familiares</span>
          <nav className="flex gap-1 flex-wrap">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  pathname === link.href
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{displayName ?? session.user.email}</span>
          <button onClick={signOut} className="btn-secondary !px-3 !py-1.5">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
