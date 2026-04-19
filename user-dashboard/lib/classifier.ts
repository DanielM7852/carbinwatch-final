/**
 * Vision / Dynamo item labels → category (matches product table).
 * Order matters: specific table rows before generic keywords.
 */
export type WasteCategory =
  | "trash"
  | "recycle"
  | "compost"
  | "special_recycling"
  | "textile_recycle";

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
  special_recycling: {
    label: "Special Recycling",
    color: "text-amber-400",
    emoji: "♻️",
    tip: "Hazardous — drop-off only, never trash.",
  },
  textile_recycle: {
    label: "Donate / Textile Recycle",
    color: "text-cyan-400",
    emoji: "♻️",
    tip: "Never trash if wearable.",
  },
};

function result(cat: WasteCategory): ClassifyResult {
  const m = CATEGORY_META[cat];
  return { category: cat, ...m };
}

/** Secondary keywords when item string is not one of the table row names. */
const KEYWORD_FALLBACK: Array<{ keys: string[]; cat: WasteCategory }> = [
  { keys: ["battery", "lithium"], cat: "special_recycling" },
  {
    keys: ["food waste", "food_waste", "food-waste", "foodwaste", "biological", "organic waste", "food scrap"],
    cat: "compost",
  },
  { keys: ["cardboard"], cat: "recycle" },
  { keys: ["clothes", "clothing", "shirt", "jeans", "sweater", "fabric", "textile"], cat: "textile_recycle" },
  { keys: ["glass"], cat: "recycle" },
  { keys: ["metal", "aluminum", "tin", "can"], cat: "recycle" },
  { keys: ["paper", "newspaper", "magazine"], cat: "recycle" },
  { keys: ["plastic", "bottle"], cat: "recycle" },
  { keys: ["apple", "banana", "lettuce", "bread", "vegetable", "fruit", "coffee", "egg"], cat: "compost" },
  { keys: ["wrapper", "chip", "straw", "styrofoam", "diaper", "tissue", "napkin"], cat: "trash" },
];

export function classifyItem(itemName: string | undefined | null): ClassifyResult {
  const lower = String(itemName ?? "")
    .toLowerCase()
    .trim();

  if (!lower) {
    return result("trash");
  }

  // --- Table rows (camera / Dynamo labels like "Plastic", "Biological", "Battery") ---
  if (lower.includes("battery")) {
    return result("special_recycling");
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
  if (
    /\bclothes\b/.test(lower) ||
    /\bclothing\b/.test(lower) ||
    /\bshirt\b/.test(lower) ||
    /\bjeans\b/.test(lower) ||
    /\bsweater\b/.test(lower) ||
    (lower.includes("textile") && !lower.includes("battery"))
  ) {
    return result("textile_recycle");
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
