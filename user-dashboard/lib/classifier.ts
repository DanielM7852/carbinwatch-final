/**
 * Vision / Dynamo item labels → category (matches product table).
 * Order matters: specific table rows before generic keywords.
 */
export type WasteCategory =
  | "trash"
  | "recycle"
  | "compost"
  | "electronic_waste";

export type ClassifyResult = {
  category: WasteCategory;
  /** Human-readable title for UI */
  label: string;
  color: string;
  emoji: string;
  tip: string;
};

const CATEGORY_META: Record<WasteCategory, Omit<ClassifyResult, "category">> = {
  trash: {
    label: "Trash",
    color: "text-red-400",
    emoji: "🗑️",
    tip: "Goes in the black bin.",
  },
  recycle: {
    label: "Recycle",
    color: "text-blue-400",
    emoji: "♻️",
    tip: "Rinse before recycling.",
  },
  compost: {
    label: "Compost",
    color: "text-green-400",
    emoji: "🌱",
    tip: "Organics / compost stream.",
  },
  electronic_waste: {
    label: "E-Waste",
    color: "text-amber-400",
    emoji: "🔌",
    tip: "Take to an e-waste drop-off — never trash.",
  },
};

function result(cat: WasteCategory): ClassifyResult {
  const m = CATEGORY_META[cat];
  return { category: cat, ...m };
}

/**
 * Item-name patterns that should ALWAYS classify as electronic waste,
 * even when the publisher tagged the row as "trash"/"recycling"/"compost".
 * The publisher only emits 3 categories, so electronics always arrive mis-tagged.
 */
const EWASTE_NAME_KEYWORDS = [
  "circuit board",
  "motherboard",
  "battery",
  "batteries",
  "charger",
  "smartphone",
  "cell phone",
  "cellphone",
  "mobile phone",
  "phone",
  "laptop",
  "tablet",
  "ipad",
  "monitor",
  "keyboard",
  "headphones",
  "earbuds",
  "headset",
  "led bulb",
  "light bulb",
  "fluorescent bulb",
  "cfl",
  "remote control",
  "printer cartridge",
  "ink cartridge",
  "toner",
  "router",
  "modem",
  "webcam",
  "electronics",
  "electronic",
  "e-waste",
  "ewaste",
];

function isEwasteName(lower: string): boolean {
  if (!lower) return false;
  for (const kw of EWASTE_NAME_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/**
 * Map a publisher-supplied category string (e.g. `"landfill"`, `"food_waste"`,
 * `"recycling"`) onto one of our 4 bins. Returns `undefined` if it does not
 * recognize the input, so callers can fall back to keyword classification.
 */
export function normalizeCategory(
  cat: string | undefined | null
): WasteCategory | undefined {
  if (cat === undefined || cat === null) return undefined;
  const c = String(cat).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (!c) return undefined;
  switch (c) {
    case "trash":
    case "landfill":
    case "garbage":
    case "waste":
      return "trash";
    case "recycle":
    case "recycling":
    case "recyclable":
    case "blue_bin":
      return "recycle";
    case "compost":
    case "food_waste":
    case "foodwaste":
    case "organic":
    case "organics":
    case "biological":
    case "green_bin":
      return "compost";
    case "electronic_waste":
    case "electronic":
    case "electronics":
    case "ewaste":
    case "e_waste":
    case "battery":
    case "ewaste_recycling":
      return "electronic_waste";
    default:
      return undefined;
  }
}

/** Secondary keywords when item string is not one of the table row names. */
const KEYWORD_FALLBACK: Array<{ keys: string[]; cat: WasteCategory }> = [
  { keys: ["battery", "lithium", "charger", "cable", "cord", "phone", "laptop", "tablet", "monitor", "keyboard", "headphones", "earbuds", "bulb", "led", "electronics", "ewaste", "e-waste"], cat: "electronic_waste" },
  {
    keys: ["food waste", "food_waste", "food-waste", "foodwaste", "biological", "organic waste", "food scrap"],
    cat: "compost",
  },
  { keys: ["cardboard"], cat: "recycle" },
  { keys: ["glass"], cat: "recycle" },
  { keys: ["metal", "aluminum", "tin", "can"], cat: "recycle" },
  { keys: ["paper", "newspaper", "magazine"], cat: "recycle" },
  { keys: ["plastic", "bottle"], cat: "recycle" },
  { keys: ["apple", "banana", "lettuce", "bread", "vegetable", "fruit", "coffee", "egg", "yogurt"], cat: "compost" },
  { keys: ["wrapper", "chip", "straw", "styrofoam", "diaper", "tissue", "napkin"], cat: "trash" },
];

export function classifyItem(
  itemName: string | undefined | null,
  categoryHint?: string | undefined | null
): ClassifyResult {
  const lower = String(itemName ?? "")
    .toLowerCase()
    .trim();

  // E-waste detection by item name overrides the publisher's category hint —
  // publisher only emits trash/recycling/compost, so electronics always arrive
  // mis-tagged. Name-match wins here.
  if (isEwasteName(lower)) {
    return result("electronic_waste");
  }

  const hinted = normalizeCategory(categoryHint);
  if (hinted) {
    return result(hinted);
  }

  if (!lower) {
    return result("trash");
  }
  // Food waste (vision / Dynamo labels) → compost
  if (
    /\bfood\s+waste\b/i.test(lower) ||
    lower.includes("food_waste") ||
    lower.includes("food-waste") ||
    lower.includes("foodwaste")
  ) {
    return result("compost");
  }
  if (lower.includes("biological")) {
    return result("compost");
  }
  if (lower.includes("cardboard")) {
    return result("recycle");
  }
  if (lower.includes("glass")) {
    return result("recycle");
  }
  if (lower.includes("metal")) {
    return result("recycle");
  }
  if (lower.includes("paper")) {
    return result("recycle");
  }
  if (lower.includes("plastic")) {
    return result("recycle");
  }
  if (lower === "trash" || /^trash\b/.test(lower)) {
    return result("trash");
  }

  // --- Keyword fallback (partial names, legacy labels) ---
  for (const { keys, cat } of KEYWORD_FALLBACK) {
    for (const key of keys) {
      const matched =
        key === "can" ? /\bcan\b/i.test(lower) : lower.includes(key);
      if (matched) {
        return result(cat);
      }
    }
  }

  return result("trash");
}
