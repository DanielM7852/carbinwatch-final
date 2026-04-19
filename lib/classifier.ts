// Rule-based waste classifier — swap with ML model output if available
const wasteMap: Record<string, "trash" | "recycle" | "compost"> = {
  // Compost
  apple: "compost",
  banana: "compost",
  orange: "compost",
  lettuce: "compost",
  bread: "compost",
  rice: "compost",
  egg: "compost",
  meat: "compost",
  coffee: "compost",
  vegetable: "compost",
  fruit: "compost",
  dairy: "compost",
  cheese: "compost",
  yogurt: "compost",
  potato: "compost",
  carrot: "compost",

  // Recycle
  bottle: "recycle",
  can: "recycle",
  cardboard: "recycle",
  paper: "recycle",
  plastic: "recycle",
  glass: "recycle",
  aluminum: "recycle",
  tin: "recycle",
  box: "recycle",
  newspaper: "recycle",
  magazine: "recycle",

  // Trash
  wrapper: "trash",
  chip: "trash",
  straw: "trash",
  styrofoam: "trash",
  diaper: "trash",
  bag: "trash",
  tissue: "trash",
  napkin: "trash",
};

export function classifyItem(itemName: string | undefined | null): {
  category: "trash" | "recycle" | "compost";
  color: string;
  emoji: string;
  tip: string;
} {
  const lower = String(itemName ?? "").toLowerCase();
  let category: "trash" | "recycle" | "compost" = "trash";

  for (const [key, val] of Object.entries(wasteMap)) {
    if (lower.includes(key)) {
      category = val;
      break;
    }
  }

  const meta = {
    trash: { color: "text-red-400", emoji: "🗑️", tip: "Goes in the black bin." },
    recycle: { color: "text-blue-400", emoji: "♻️", tip: "Rinse before recycling." },
    compost: { color: "text-green-400", emoji: "🌱", tip: "Great for compost!" },
  };

  return { category, ...meta[category] };
}
