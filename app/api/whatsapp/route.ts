// Webhook de WhatsApp (Meta Cloud API). Recibe los mensajes que la
// pareja manda al número de la app y los convierte en gastos.
//
// Variables de entorno necesarias en Vercel (ver README, sección 3.6):
//   WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_ACCESS_TOKEN,
//   WHATSAPP_PHONE_NUMBER_ID, SUPABASE_SERVICE_ROLE_KEY
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { descriptionKey, monthEndKey, normalizeText } from "@/lib/insights";
import { detectCommand, HELP_TEXT, parseExpenseMessage } from "@/lib/whatsappParser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Link = { phone: string; user_id: string; household_id: string };

function admin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function todayEcuador() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

async function sendText(to: string, body: string) {
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    console.error("WhatsApp: faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN");
    return;
  }
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
  });
  if (!res.ok) console.error("WhatsApp: error al responder", res.status, await res.text());
}

// --- Verificación del webhook (Meta llama con GET una sola vez al configurarlo)
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// --- Mensajes entrantes
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Solo aceptamos mensajes firmados por Meta: sin esto, cualquiera que
  // conozca la URL podría inventar gastos.
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("WhatsApp: faltan WHATSAPP_APP_SECRET o SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const valid =
    signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return new NextResponse("Invalid signature", { status: 401 });

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const db = admin();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        try {
          await handleMessage(db, msg);
        } catch (err) {
          console.error("WhatsApp: error procesando mensaje", err);
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}

async function handleMessage(db: SupabaseClient, msg: any) {
  const from: string = String(msg.from ?? "").replace(/\D/g, "");
  const waId: string = msg.id;
  if (!from || !waId) return;
  const text: string = msg.type === "text" ? String(msg.text?.body ?? "").trim() : "";

  // Evita procesar dos veces el mismo mensaje si WhatsApp lo reenvía.
  const { error: dupError } = await db.from("whatsapp_messages").insert({ wa_message_id: waId, phone: from, body: text });
  if (dupError) return;

  if (msg.type !== "text") {
    await sendText(
      from,
      "📷 Por ahora solo entiendo mensajes de texto, por ejemplo: *gasolina 20*. Leer fotos de recibos viene en una próxima versión."
    );
    return;
  }

  const command = detectCommand(text);

  if (command.type === "link") {
    await linkNumber(db, from, command.code);
    return;
  }

  const { data: link } = await db.from("whatsapp_links").select("phone, user_id, household_id").eq("phone", from).maybeSingle();
  if (!link) {
    await sendText(
      from,
      "Hola 👋 Este número todavía no está vinculado a Finanzas Familiares. Entra a la app → *💬 WhatsApp* → *Generar código*, y mándame el mensaje que te aparece (ej. *vincular AB12CD*)."
    );
    return;
  }

  if (command.type === "help") return sendText(from, HELP_TEXT);
  if (command.type === "undo") return undoLast(db, link as Link);
  if (command.type === "summary") return sendSummary(db, link as Link);
  if (command.type === "query") return answerQuery(db, link as Link, command.text);
  return registerExpense(db, link as Link, text, waId);
}

async function linkNumber(db: SupabaseClient, from: string, code: string) {
  const { data: row } = await db
    .from("whatsapp_link_codes")
    .select("code, user_id, household_id, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!row || new Date(row.expires_at) < new Date()) {
    await sendText(from, "❌ Ese código no existe o ya venció (duran 15 minutos). Genera uno nuevo en la app → 💬 WhatsApp.");
    return;
  }
  await db
    .from("whatsapp_links")
    .upsert({ phone: from, user_id: row.user_id, household_id: row.household_id }, { onConflict: "phone" });
  await db.from("whatsapp_link_codes").delete().eq("code", code);
  const { data: member } = await db
    .from("household_members")
    .select("display_name")
    .eq("user_id", row.user_id)
    .eq("household_id", row.household_id)
    .maybeSingle();
  await sendText(
    from,
    `✅ Listo${member?.display_name ? `, ${member.display_name}` : ""}! Este número quedó vinculado. Desde ahora puedes registrar gastos escribiéndome.\n\n${HELP_TEXT}`
  );
}

async function loadContext(db: SupabaseClient, householdId: string) {
  const [cats, cards, budgets] = await Promise.all([
    db.from("categories").select("id, name, icon").eq("household_id", householdId),
    db.from("cards").select("id, name").eq("household_id", householdId),
    db.from("category_budgets").select("category_id, monthly_limit").eq("household_id", householdId),
  ]);
  return {
    categories: (cats.data ?? []) as { id: string; name: string; icon: string }[],
    cards: (cards.data ?? []) as { id: string; name: string }[],
    budgets: (budgets.data ?? []) as { category_id: string; monthly_limit: number }[],
  };
}

async function monthSpentInCategory(db: SupabaseClient, householdId: string, categoryId: string, month: string) {
  const { data } = await db
    .from("expenses")
    .select("amount")
    .eq("household_id", householdId)
    .eq("category_id", categoryId)
    .gte("expense_date", `${month}-01`)
    .lte("expense_date", monthEndKey(month));
  return (data ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
}

async function registerExpense(db: SupabaseClient, link: Link, text: string, waId: string) {
  const ctx = await loadContext(db, link.household_id);
  const { data: history } = await db
    .from("expenses")
    .select("description, category_id")
    .eq("household_id", link.household_id)
    .order("created_at", { ascending: false })
    .limit(400);

  const parsed = parseExpenseMessage(text, ctx.cards, ctx.categories, (history ?? []) as any);
  if (!parsed || !parsed.categoryId) {
    await sendText(link.phone, `🤔 No encontré el monto. Escríbelo así: *descripción monto*, por ejemplo *gasolina 20*.\n\nEscribe *ayuda* para ver más ejemplos.`);
    return;
  }

  const date = todayEcuador();
  const { data: inserted, error } = await db
    .from("expenses")
    .insert({
      household_id: link.household_id,
      category_id: parsed.categoryId,
      card_id: parsed.cardId,
      description: parsed.description,
      amount: parsed.amount,
      expense_date: date,
      is_recurring: false,
      is_extra: parsed.isExtra,
      is_free_money: parsed.isFreeMoney,
      created_by: link.user_id,
      source: "whatsapp",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("WhatsApp: error guardando gasto", error);
    await sendText(link.phone, "⚠️ No pude guardar el gasto por un error. Intenta de nuevo en un momento o regístralo en la app.");
    return;
  }
  await db.from("whatsapp_messages").update({ expense_id: inserted.id }).eq("wa_message_id", waId);

  // ¿Ya había uno igual hoy?
  const { data: sameDay } = await db
    .from("expenses")
    .select("id, description")
    .eq("household_id", link.household_id)
    .eq("expense_date", date)
    .eq("amount", parsed.amount)
    .neq("id", inserted.id);
  const duplicate = (sameDay ?? []).some((e: any) => descriptionKey(e.description) === descriptionKey(parsed.description));

  const cat = ctx.categories.find((c) => c.id === parsed.categoryId);
  const card = ctx.cards.find((c) => c.id === parsed.cardId);
  const month = date.slice(0, 7);
  const spent = await monthSpentInCategory(db, link.household_id, parsed.categoryId, month);
  const limit = Number(ctx.budgets.find((b) => b.category_id === parsed.categoryId)?.monthly_limit ?? 0);

  const lines = [
    `✅ Registrado: *${money(parsed.amount)}* · ${parsed.description}`,
    `${cat ? `${cat.icon} ${cat.name}` : ""}${card ? ` · 💳 ${card.name}` : " · efectivo / sin tarjeta"}`,
  ];
  const tags = [parsed.isFreeMoney ? "🎈 plata libre" : "", parsed.isExtra ? "⚡ no planeado" : ""].filter(Boolean);
  if (tags.length) lines.push(tags.join(" · "));
  if (limit > 0) {
    const pct = (spent / limit) * 100;
    const icon = pct >= 100 ? "🔴" : pct >= 80 ? "🟡" : "🟢";
    lines.push(`${icon} Llevan ${money(spent)} de ${money(limit)} en ${cat?.name ?? "esta categoría"} este mes (${pct.toFixed(0)}%).`);
  } else {
    lines.push(`Llevan ${money(spent)} en ${cat?.name ?? "esta categoría"} este mes.`);
  }
  if (parsed.categoryReason === "otros") lines.push("📦 No supe la categoría, lo dejé en Otros — puedes cambiarla en la app.");
  if (duplicate) lines.push("👀 Ojo: ya había un gasto igual hoy. Si fue por error, responde *deshacer*.");
  else lines.push("Si algo está mal, responde *deshacer*.");

  await sendText(link.phone, lines.join("\n"));
}

async function undoLast(db: SupabaseClient, link: Link) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: last } = await db
    .from("expenses")
    .select("id, description, amount")
    .eq("household_id", link.household_id)
    .eq("created_by", link.user_id)
    .eq("source", "whatsapp")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) {
    await sendText(link.phone, "No encontré nada registrado por WhatsApp en las últimas 24 horas para deshacer.");
    return;
  }
  await db.from("expenses").delete().eq("id", last.id);
  await sendText(link.phone, `↩️ Borré: *${money(Number(last.amount))}* · ${last.description}`);
}

async function sendSummary(db: SupabaseClient, link: Link) {
  const month = todayEcuador().slice(0, 7);
  const ctx = await loadContext(db, link.household_id);
  const [{ data: exp }, { data: inc }] = await Promise.all([
    db
      .from("expenses")
      .select("amount, category_id, is_card_payment")
      .eq("household_id", link.household_id)
      .gte("expense_date", `${month}-01`)
      .lte("expense_date", monthEndKey(month)),
    db
      .from("income_entries")
      .select("amount")
      .eq("household_id", link.household_id)
      .gte("entry_date", `${month}-01`)
      .lte("entry_date", monthEndKey(month)),
  ]);
  const spent = (exp ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
  const income = (inc ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  (exp ?? []).forEach((e: any) => {
    if (e.is_card_payment) return;
    byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + Number(e.amount));
  });
  const top = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amt]) => {
      const c = ctx.categories.find((x) => x.id === id);
      return `• ${c ? `${c.icon} ${c.name}` : "Sin categoría"}: ${money(amt)}`;
    });
  const balance = income - spent;
  await sendText(
    link.phone,
    [
      `📊 *Resumen del mes*`,
      `💵 Ingresos: ${money(income)}`,
      `🧾 Gastos: ${money(spent)}`,
      `${balance >= 0 ? "🎉" : "⚠️"} Balance: ${money(balance)}`,
      top.length ? `\nLo que más pesa:\n${top.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

async function answerQuery(db: SupabaseClient, link: Link, normText: string) {
  const ctx = await loadContext(db, link.household_id);
  const cat = ctx.categories.find((c) =>
    normalizeText(c.name)
      .split(" ")
      .filter((w) => w.length >= 4)
      .some((w) => normText.includes(w))
  );
  if (!cat) return sendSummary(db, link);
  const month = todayEcuador().slice(0, 7);
  const spent = await monthSpentInCategory(db, link.household_id, cat.id, month);
  const limit = Number(ctx.budgets.find((b) => b.category_id === cat.id)?.monthly_limit ?? 0);
  if (limit > 0) {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const today = Number(todayEcuador().slice(8, 10));
    const pct = (spent / limit) * 100;
    await sendText(
      link.phone,
      `${cat.icon} Llevan *${money(spent)}* de ${money(limit)} en ${cat.name} este mes (${pct.toFixed(0)}%). Quedan ${money(
        Math.max(limit - spent, 0)
      )} y ${lastDay - today} días.`
    );
  } else {
    await sendText(link.phone, `${cat.icon} Llevan *${money(spent)}* en ${cat.name} este mes (sin límite definido).`);
  }
}
