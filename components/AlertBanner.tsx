"use client";

import { Alert } from "@/lib/utils";

const styles: Record<Alert["level"], string> = {
  red: "bg-red-50 border-red-200 text-red-800",
  yellow: "bg-amber-50 border-amber-200 text-amber-800",
  blue: "bg-sky-50 border-sky-200 text-sky-800",
};

export default function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm">
        ✅ Todo tranquilo: no hay alertas activas por ahora.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div key={a.id} className={`card border ${styles[a.level]}`}>
          <p className="font-medium text-sm">{a.title}</p>
          <p className="text-sm opacity-90">{a.message}</p>
        </div>
      ))}
    </div>
  );
}
