"use client";

// Piezas visuales compartidas por toda la app: íconos, colores de acento,
// encabezado de página y secciones plegables. Así todas las pestañas se ven
// iguales.
import { ReactNode, useEffect, useRef, useState } from "react";

// -----------------------------------------------------------------
// ÍCONOS (línea, 24x24)
// -----------------------------------------------------------------
const PATHS: Record<string, string> = {
  dashboard: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  receipt: "M5 2v20l2.3-1.5L9.7 22 12 20.5 14.3 22l2.4-1.5L19 22V2l-2.3 1.5L14.3 2 12 3.5 9.7 2 7.3 3.5z M9 8h6 M9 12h6 M9 16h3",
  wallet: "M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v4 M3 5v14a2 2 0 0 0 2 2h15v-6 M21 11h-5a2 2 0 0 0 0 4h5z",
  card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z M2 10h20 M6 15h4",
  heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
  chart: "M3 3v18h18 M7 16v-4 M12 16V8 M17 16v-7",
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5z M8 11.5h.01 M12 11.5h.01 M16 11.5h.01",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01",
  bulb: "M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0",
  calendar: "M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M16 3v4 M8 3v4 M3 10h18 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  star: "M12 2 15 8.5l7 .8-5.2 4.8 1.4 6.9L12 17.6 5.8 21l1.4-6.9L2 9.3l7-.8z",
  trend: "m3 17 6-6 4 4 8-8 M14 7h7v7",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  pie: "M21.2 15.9A10 10 0 1 1 8 2.8 M22 12A10 10 0 0 0 12 2v10z",
  repeat: "m17 2 4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3",
  plus: "M12 5v14 M5 12h14",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  gift: "M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  filter: "M22 3H2l8 9.5V19l4 2v-8.5z",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  phone: "M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2",
  userPlus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01",
  chevronDown: "m6 9 6 6 6-6",
  chevronLeft: "m15 18-6-6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  x: "M18 6 6 18 M6 6l12 12",
  pin: "M12 17v5 M9 10.8V4h6v6.8l2 3.2H7z",
  grip: "M9 5h.01 M9 12h.01 M9 19h.01 M15 5h.01 M15 12h.01 M15 19h.01",
  arrowUp: "M12 19V5 M5 12l7-7 7 7",
  arrowDown: "M12 5v14 M19 12l-7 7-7-7",
  scale: "M12 3v18 M5 21h14 M3 7h18 M6 7l-3 7a3 3 0 0 0 6 0z M18 7l-3 7a3 3 0 0 0 6 0z",
  expand: "M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7",
  shrink: "M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "w-5 h-5", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// -----------------------------------------------------------------
// COLORES DE ACENTO (clases completas para que Tailwind las incluya)
// -----------------------------------------------------------------
export const ACCENTS = {
  indigo: { tile: "from-indigo-500 to-violet-500", soft: "bg-indigo-50", text: "text-indigo-600", ring: "ring-indigo-500", top: "border-t-indigo-500", glow: "shadow-indigo-500/30" },
  rose: { tile: "from-rose-500 to-orange-500", soft: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-500", top: "border-t-rose-500", glow: "shadow-rose-500/30" },
  sky: { tile: "from-sky-500 to-cyan-500", soft: "bg-sky-50", text: "text-sky-600", ring: "ring-sky-500", top: "border-t-sky-500", glow: "shadow-sky-500/30" },
  amber: { tile: "from-amber-500 to-orange-500", soft: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-500", top: "border-t-amber-500", glow: "shadow-amber-500/30" },
  emerald: { tile: "from-emerald-500 to-teal-500", soft: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-500", top: "border-t-emerald-500", glow: "shadow-emerald-500/30" },
  violet: { tile: "from-violet-500 to-fuchsia-500", soft: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-500", top: "border-t-violet-500", glow: "shadow-violet-500/30" },
  pink: { tile: "from-pink-500 to-purple-500", soft: "bg-pink-50", text: "text-pink-600", ring: "ring-pink-500", top: "border-t-pink-500", glow: "shadow-pink-500/30" },
  teal: { tile: "from-teal-500 to-emerald-500", soft: "bg-teal-50", text: "text-teal-600", ring: "ring-teal-500", top: "border-t-teal-500", glow: "shadow-teal-500/30" },
  slate: { tile: "from-slate-600 to-slate-800", soft: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-500", top: "border-t-slate-500", glow: "shadow-slate-500/30" },
} as const;

export type Accent = keyof typeof ACCENTS;

export function IconTile({ icon, accent, size = "md" }: { icon: IconName; accent: Accent; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-8 h-8 rounded-lg" : size === "lg" ? "w-12 h-12 rounded-2xl" : "w-10 h-10 rounded-xl";
  const ico = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <span
      className={`${dims} flex-shrink-0 flex items-center justify-center text-white bg-gradient-to-br shadow-md ${ACCENTS[accent].tile} ${ACCENTS[accent].glow}`}
    >
      <Icon name={icon} className={ico} />
    </span>
  );
}

// -----------------------------------------------------------------
// ENCABEZADO DE PÁGINA (igual en todas las pestañas)
// -----------------------------------------------------------------
export function PageHeader({
  icon,
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  icon: IconName;
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white shadow-xl shadow-indigo-500/20">
      <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-white/10" aria-hidden />
      <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex flex-col md:flex-row md:items-center gap-4 p-5 md:p-7">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className="w-14 h-14 flex-shrink-0 rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur flex items-center justify-center">
            <Icon name={icon} className="w-7 h-7" />
          </span>
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] uppercase tracking-[0.14em] text-white/70 font-semibold">{eyebrow}</p>}
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap header-actions">{actions}</div>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// SECCIÓN PLEGABLE (para todas las pestañas)
// -----------------------------------------------------------------
export function Section({
  id,
  icon,
  accent,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  openSignal,
  children,
}: {
  id: string;
  icon: IconName;
  accent: Accent;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  openSignal?: unknown; // cuando cambia (y no es vacío), la sección se abre sola
  children: ReactNode;
}) {
  const storageKey = `ff-seccion-${id}`;
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === "1");
    } catch {
      /* ignorar */
    }
  }, [storageKey]);

  useEffect(() => {
    if (openSignal) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [openSignal]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignorar */
    }
  }

  return (
    <section
      ref={ref}
      className={`bg-white rounded-3xl border border-slate-200/70 shadow-sm transition-shadow scroll-mt-24 ${
        open ? "shadow-md" : "hover:shadow-md"
      }`}
    >
      <button onClick={toggle} aria-expanded={open} className="w-full flex items-center gap-3 md:gap-4 px-4 md:px-5 py-4 text-left">
        <IconTile icon={icon} accent={accent} />
        <span className="flex-1 min-w-0">
          <span className="block font-heading font-semibold text-[15px] text-slate-900 truncate">{title}</span>
          {subtitle && <span className="block text-xs text-slate-500 truncate">{subtitle}</span>}
        </span>
        {badge && <span className="hidden sm:inline-flex">{badge}</span>}
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
            open ? `${ACCENTS[accent].soft} ${ACCENTS[accent].text} rotate-180` : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon name="chevronDown" className="w-4 h-4" />
        </span>
      </button>
      {open && <div className="section-body border-t border-slate-100 px-4 md:px-5 py-5">{children}</div>}
    </section>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "red" | "green" | "amber" | "indigo" | "slate" }) {
  const tones = {
    red: "bg-rose-100 text-rose-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-slate-50 border border-slate-200/70 rounded-2xl px-4 py-3 text-sm text-slate-600 mb-4">
      <Icon name="info" className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
      <div>{children}</div>
    </div>
  );
}
