"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useHousehold } from "@/lib/HouseholdContext";
import Avatar from "@/components/Avatar";

const links = [
  { href: "/", icon: "📊", label: "Dashboard" },
  { href: "/gastos", icon: "🧾", label: "Gastos" },
  { href: "/ingresos", icon: "💵", label: "Ingresos" },
  { href: "/tarjetas", icon: "💳", label: "Tarjetas" },
  { href: "/pareja", icon: "💞", label: "Pareja" },
  { href: "/promedios", icon: "📈", label: "Promedios" },
  { href: "/whatsapp", icon: "💬", label: "WhatsApp" },
  { href: "/categorias", icon: "🏷️", label: "Categorías y límites" },
];

const PIN_KEY = "ff-menu-fijado";

// Estructura de la app: barra superior con botón ☰ y un menú lateral
// izquierdo que se abre/cierra. En computador se puede "fijar" abierto.
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, displayName, signOut } = useHousehold();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* sin almacenamiento: queda sin fijar */
    }
  }, []);

  // Al cambiar de página se cierra el menú (si no está fijado).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    setOpen(false);
    try {
      localStorage.setItem(PIN_KEY, next ? "1" : "0");
    } catch {
      /* ignorar */
    }
  }

  if (!session) {
    return <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>;
  }

  const name = displayName ?? session.user.email ?? "?";
  const current = links.find((l) => l.href === pathname);

  const menu = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <span className="font-heading font-bold text-brand-700">💰 Finanzas Familiares</span>
        <button
          onClick={() => setOpen(false)}
          className={`w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 ${pinned ? "lg:hidden" : ""}`}
          aria-label="Cerrar menú"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? "bg-brand-gradient text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="text-lg w-6 text-center">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </div>
      <div className="p-3 border-t border-slate-100 space-y-2">
        <button
          onClick={togglePin}
          className="hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100"
        >
          📌 {pinned ? "Soltar menú (que se oculte)" : "Fijar menú abierto"}
        </button>
        <div className="flex items-center gap-2 px-2">
          <Avatar name={name} size="sm" />
          <span className="text-sm text-slate-700 truncate flex-1">{name}</span>
          <button onClick={signOut} className="text-xs font-medium text-red-500 hover:underline">
            Salir
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Menú fijado (solo computador) */}
      {pinned && (
        <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30">
          {menu}
        </aside>
      )}

      {/* Menú desplegable */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${pinned ? "lg:hidden" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${pinned ? "lg:hidden" : ""}`}
        aria-hidden={!open}
      >
        {menu}
      </aside>

      <div className={pinned ? "lg:pl-64" : ""}>
        <header className="bg-brand-gradient shadow-md sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setOpen(true)}
                className={`flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-medium px-3 py-1.5 rounded-xl transition-colors ${
                  pinned ? "lg:hidden" : ""
                }`}
                aria-label="Abrir menú"
              >
                <span className="text-lg leading-none">☰</span>
                <span className="text-sm hidden sm:inline">Menú</span>
              </button>
              <span className="font-heading font-bold text-white text-lg drop-shadow-sm truncate">
                {current ? `${current.icon} ${current.label}` : "💰 Finanzas Familiares"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm flex-shrink-0">
              <Avatar name={name} size="sm" />
              <span className="text-white/85 hidden sm:inline">{name}</span>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
