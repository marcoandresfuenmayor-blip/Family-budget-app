"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useHousehold } from "@/lib/HouseholdContext";
import Avatar from "@/components/Avatar";
import FeedbackButton from "@/components/FeedbackButton";
import { Icon, IconName } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";

const groups: { label: string; links: { href: string; icon: IconName; label: string; help: string }[] }[] = [
  {
    label: "General",
    links: [
      { href: "/", icon: "dashboard", label: "Dashboard", help: "Resumen del mes: ingresos, gastos, alertas y cómo van sus metas" },
      { href: "/gastos", icon: "receipt", label: "Gastos", help: "Registrar y revisar gastos, gastos fijos y compras a cuotas" },
      { href: "/ingresos", icon: "wallet", label: "Ingresos", help: "Sueldos, ingresos extra y lo que esperan recibir" },
      { href: "/tarjetas", icon: "card", label: "Tarjetas", help: "Cortes, pagos y consumos de cada tarjeta de crédito" },
    ],
  },
  {
    label: "Análisis",
    links: [
      { href: "/promedios", icon: "chart", label: "Promedios", help: "Cuánto pagan en promedio por cada servicio o gasto que se repite" },
      { href: "/pareja", icon: "heart", label: "Pareja", help: "Chequeo quincenal, resumen en palabras y plata libre de cada uno" },
    ],
  },
  {
    label: "Configuración",
    links: [
      { href: "/whatsapp", icon: "chat", label: "WhatsApp", help: "Vincular sus celulares para registrar gastos por WhatsApp" },
      { href: "/categorias", icon: "tag", label: "Categorías y límites", help: "Categorías, límites mensuales y código para invitar a tu pareja" },
      { href: "/perfil", icon: "users", label: "Mi perfil", help: "Edad, género y ciudad (opcional) para ayudarnos a mejorar la app" },
    ],
  },
];

const adminGroup = {
  label: "Administración",
  links: [
    { href: "/admin", icon: "chart" as IconName, label: "Clientes", help: "Quiénes usan la app y qué opinan (datos agrupados y anónimos)" },
  ],
};

const PIN_KEY = "ff-menu-fijado";

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
        <Icon name="wallet" className="w-5 h-5" />
      </span>
      <span className="leading-tight">
        <span className={`block font-heading font-bold text-[15px] ${dark ? "text-white" : "text-slate-900"}`}>Finanzas</span>
        <span className={`block text-[11px] font-medium tracking-wide ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Familiares
        </span>
      </span>
    </span>
  );
}

// Estructura de la app: barra superior y menú lateral que se abre con el
// botón (en computador se puede "fijar" abierto).
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, displayName, signOut } = useHousehold();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("is_app_admin").then(({ data }) => setIsAdmin(data === true));
  }, [session]);

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  useEffect(() => {
    setOpen(false);
    setUserMenu(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setUserMenu(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
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
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const menu = (
    <nav className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="px-5 h-16 flex items-center justify-between border-b border-white/5">
        <Logo dark />
        <button
          onClick={() => setOpen(false)}
          className={`w-8 h-8 rounded-lg hover:bg-white/10 text-slate-400 flex items-center justify-center ${pinned ? "lg:hidden" : ""}`}
          aria-label="Cerrar menú"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {(isAdmin ? [...groups, adminGroup] : groups).map((g) => (
          <div key={g.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{g.label}</p>
            <div className="space-y-0.5">
              {g.links.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    title={l.help}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient" />}
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        active ? "bg-brand-gradient text-white shadow-lg shadow-indigo-500/30" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      <Icon name={l.icon} className="w-4 h-4" />
                    </span>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-white/5 space-y-1">
        <button
          onClick={togglePin}
          className="hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <Icon name="pin" className="w-4 h-4" />
          {pinned ? "Ocultar menú lateral" : "Fijar menú abierto"}
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5">
          <Avatar name={name} size="sm" />
          <span className="text-sm text-white truncate flex-1">{name}</span>
          <button onClick={signOut} className="text-slate-400 hover:text-rose-400" aria-label="Salir" title="Salir">
            <Icon name="logout" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {pinned && <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30">{menu}</aside>}

      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${pinned ? "lg:hidden" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${pinned ? "lg:hidden" : ""}`}
        aria-hidden={!open}
      >
        {menu}
      </aside>

      <div className={pinned ? "lg:pl-64" : ""}>
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                className={`w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-sm ${
                  pinned ? "lg:hidden" : ""
                }`}
                aria-label="Abrir menú"
              >
                <Icon name="menu" className="w-5 h-5" />
              </button>
              <Link href="/" className={pinned ? "lg:hidden" : ""}>
                <Logo />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full capitalize">
                <Icon name="calendar" className="w-3.5 h-3.5" />
                {today}
              </span>
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <Avatar name={name} size="md" />
                  <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[140px] truncate">{name}</span>
                  <Icon name="chevronDown" className="w-4 h-4 text-slate-400" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/70 p-2">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                      <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                    </div>
                    <Link
                      href="/perfil"
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Icon name="users" className="w-4 h-4" />
                      Mi perfil
                    </Link>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <Icon name="logout" className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6 pb-20 space-y-0">{children}</main>
      </div>
      <FeedbackButton />
    </div>
  );
}
