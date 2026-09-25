// Interpreta mensajes de WhatsApp como "gasolina 20" o
// "supermaxi 34,50 tarjeta daya libre". Funciones puras, sin base de datos,
// para poder probarlas fácilmente.
import { descriptionKey, normalizeText } from "./insights";

type CardLite = { id: string; name: string };
type CategoryLite = { id: string; name: string; icon: string };
type HistoryLite = { description: string; category_id: string };

// Palabra clave -> palabra que aparece en el nombre de la categoría.
const KEYWORDS: Record<string, string[]> = {
  transporte: [
    "gasolina", "gasolinera", "combustible", "diesel", "uber", "taxi", "bus", "peaje", "parqueo",
    "parqueadero", "cabify", "indriver", "didi", "mecanico", "llantas", "repuesto", "repuestos",
    "matricula", "lavada", "metro", "pasaje",
  ],
  alimentacion: [
    "super", "supermaxi", "supermercado", "comisariato", "tia", "aki", "coral", "mercado", "comida",
    "almuerzo", "desayuno", "cena", "restaurante", "kfc", "mcdonalds", "pizza", "cafe", "panaderia",
    "pan", "frutas", "verduras", "rappi", "pedidosya", "snack", "snacks", "helado", "gourmet",
    "carne", "pollo", "tienda", "viveres",
  ],
  servicios: [
    "luz", "electricidad", "cnel", "agua", "interagua", "internet", "telefono", "celular", "plan",
    "claro", "movistar", "cnt", "netlife", "tvcable", "gas", "cilindro", "alicuota", "recarga",
  ],
  salud: [
    "farmacia", "fybeca", "medicina", "medicinas", "medico", "doctor", "consulta", "dentista",
    "odontologo", "laboratorio", "examen", "examenes", "pharmacys", "cruz azul", "sana sana", "vitaminas",
  ],
  educacion: ["colegio", "escuela", "universidad", "pension", "libros", "utiles", "curso", "clases", "guarderia"],
  entretenimiento: [
    "cine", "netflix", "spotify", "disney", "hbo", "prime", "youtube", "juego", "fiesta", "bar",
    "salida", "concierto", "futbol", "cancha", "karaoke", "discoteca",
  ],
  vivienda: ["arriendo", "alquiler", "renta", "hipoteca", "condominio"],
  tarjetas: ["prestamo", "deuda", "credito"],
  ahorro: ["ahorro", "inversion", "poliza"],
};

function hasWord(normText: string, phrase: string) {
  const p = normalizeText(phrase);
  if (!p) return false;
  return new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normText);
}

function removeWord(normText: string, phrase: string) {
  const p = normalizeText(phrase);
  return normText
    .replace(new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "g"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedExpense = {
  amount: number;
  description: string;
  cardId: string | null;
  categoryId: string | null;
  categoryReason: "historial" | "categoria" | "palabra clave" | "otros" | "ninguna";
  isFreeMoney: boolean;
  isExtra: boolean;
};

export function parseAmount(text: string): { amount: number; rest: string } | null {
  // Busca números sueltos: 20 · 20.5 · 34,50 · $12
  const regex = /(^|\s)\$?\s?(\d{1,6}(?:[.,]\d{1,2})?)(?=\s|$)/g;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = regex.exec(text)) !== null) last = match;
  if (!last) return null;
  const amount = parseFloat(last[2].replace(",", "."));
  if (!isFinite(amount) || amount <= 0) return null;
  const rest = (text.slice(0, last.index) + " " + text.slice(last.index + last[0].length)).replace(/\s+/g, " ").trim();
  return { amount, rest };
}

export function parseExpenseMessage(
  text: string,
  cards: CardLite[],
  categories: CategoryLite[],
  history: HistoryLite[]
): ParsedExpense | null {
  const parsed = parseAmount(text.trim());
  if (!parsed) return null;

  let norm = normalizeText(parsed.rest);

  const isFreeMoney = hasWord(norm, "libre");
  if (isFreeMoney) norm = removeWord(norm, "libre");
  const isExtra = hasWord(norm, "extra");
  if (isExtra) norm = removeWord(norm, "extra");

  // Tarjeta: si se menciona el nombre de alguna.
  let cardId: string | null = null;
  const sortedCards = cards.slice().sort((a, b) => b.name.length - a.name.length);
  for (const c of sortedCards) {
    if (hasWord(norm, c.name)) {
      cardId = c.id;
      norm = removeWord(norm, c.name);
      break;
    }
  }
  if (!cardId) {
    // También sirve solo el primer nombre ("marco" para la tarjeta "Marco Andres").
    for (const c of sortedCards) {
      const first = normalizeText(c.name).split(" ")[0];
      if (first.length >= 3 && hasWord(norm, first)) {
        cardId = c.id;
        norm = removeWord(norm, first);
        break;
      }
    }
  }
  if (!cardId && hasWord(norm, "tarjeta") && cards.length === 1) cardId = cards[0].id;
  norm = removeWord(norm, "con tarjeta");
  norm = removeWord(norm, "tarjeta");
  norm = norm.replace(/(^|\s)(con|de|en|la|el)$/, "").trim();
  norm = norm.replace(/^(pague|pagamos|pago|compre|compramos|gaste|gastamos|gasto de|gasto en)\s+/, "").trim();
  norm = norm.replace(/^(en|de|el|la|un|una)\s+/, "").trim();

  const description = norm ? norm.charAt(0).toUpperCase() + norm.slice(1) : "Gasto por WhatsApp";
  const key = descriptionKey(description);

  // 1) Historial: si ya registraron algo con este mismo nombre, usa su categoría.
  let categoryId: string | null = null;
  let categoryReason: ParsedExpense["categoryReason"] = "ninguna";
  const exact = history.find((h) => descriptionKey(h.description) === key);
  if (exact) {
    categoryId = exact.category_id;
    categoryReason = "historial";
  }
  if (!categoryId && key) {
    const firstWord = key.split(" ")[0];
    if (firstWord.length >= 4) {
      const similar = history.find((h) => descriptionKey(h.description).split(" ")[0] === firstWord);
      if (similar) {
        categoryId = similar.category_id;
        categoryReason = "historial";
      }
    }
  }

  // 2) El mensaje menciona el nombre de una categoría.
  if (!categoryId) {
    for (const c of categories) {
      const words = normalizeText(c.name).split(" ").filter((w) => w.length >= 4);
      if (words.some((w) => hasWord(key, w))) {
        categoryId = c.id;
        categoryReason = "categoria";
        break;
      }
    }
  }

  // 3) Palabras clave conocidas.
  if (!categoryId) {
    outer: for (const [catWord, keywords] of Object.entries(KEYWORDS)) {
      if (keywords.some((k) => hasWord(key, k))) {
        const cat = categories.find((c) => normalizeText(c.name).includes(catWord));
        if (cat) {
          categoryId = cat.id;
          categoryReason = "palabra clave";
          break outer;
        }
      }
    }
  }

  // 4) Si nada coincide, "Otros".
  if (!categoryId) {
    const otros = categories.find((c) => normalizeText(c.name).includes("otros"));
    if (otros) {
      categoryId = otros.id;
      categoryReason = "otros";
    } else if (categories[0]) {
      categoryId = categories[0].id;
      categoryReason = "otros";
    }
  }

  return { amount: parsed.amount, description, cardId, categoryId, categoryReason, isFreeMoney, isExtra };
}

export type Command =
  | { type: "link"; code: string }
  | { type: "help" }
  | { type: "undo" }
  | { type: "summary" }
  | { type: "query"; text: string }
  | { type: "expense" };

export function detectCommand(text: string): Command {
  const norm = normalizeText(text);
  const link = norm.match(/^vincular\s+([a-z0-9]{6})$/);
  if (link) return { type: "link", code: link[1].toUpperCase() };
  if (!norm || ["ayuda", "help", "hola", "menu", "comandos", "buenas", "buenos dias", "buenas tardes", "buenas noches"].includes(norm))
    return { type: "help" };
  if (/^(deshacer|borrar|borra|anular|eliminar)( ultimo| el ultimo| eso)?$/.test(norm)) return { type: "undo" };
  if (/^(resumen|como vamos|como estamos|balance)$/.test(norm)) return { type: "summary" };
  if (/^(cuanto|cuantos)\s/.test(norm)) return { type: "query", text: norm };
  return { type: "expense" };
}

export const HELP_TEXT = [
  "👋 Así me puedes escribir:",
  "• *gasolina 20* → registra $20 (la categoría la adivino)",
  "• *supermaxi 34,50 daya* → con la tarjeta Daya",
  "• *almuerzo 8 libre* → de tu plata libre",
  "• *cine 12 extra* → marcado como no planeado",
  "• *cuánto llevo en alimentación* → cómo van en esa categoría",
  "• *resumen* → el mes en un mensaje",
  "• *deshacer* → borra lo último que registraste por aquí",
].join("\n");
