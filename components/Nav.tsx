"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHousehold } from "@/lib/HouseholdContext";
import Avatar from "@/components/Avatar";

const links = [
  { href: "/", label: "📊 Dashboard" },
  { href: "/gastos", label: "🧾 Gastos" },
  { href: "/ingresos", label: "💵 Ingresos" },
  { href: "/tarjetas", label: "💳 Tarjetas" },
  { href: "/categorias", label: "🏷️ Categorías y límites" },
];

export default function Nav() {
  const pathname = usePathname();
  const { session, displayName, signOut } = useHousehold();

  if (!session) return null;

  return (
    <header className="bg-brand-gradient shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="font-heading font-bold text-white text-lg drop-shadow-sm">
            💰 Finanzas Familiares
          </span>
          <nav className="flex gap-1 flex-wrap">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-white/85 hover:bg-white/15"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Avatar name={displayName ?? session.user.email ?? "?"} size="sm" />
          <span className="text-white/85">{displayName ?? session.user.email}</span>
          <button
            onClick={signOut}
            className="bg-white/15 hover:bg-white/25 text-white font-medium px-3 py-1.5 rounded-xl transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
