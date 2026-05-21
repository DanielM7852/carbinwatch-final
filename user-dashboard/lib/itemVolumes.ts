/**
 * Hard-coded volume estimates for ~100 common household waste items, in cm³.
 * Used because upstream classifiers cannot reliably estimate volume — we look
 * up by item name instead. Matching is case-insensitive substring; longest
 * keyword wins, so "banana peel" beats "banana".
 */

type VolumeEntry = { keywords: string[]; cm3: number };

const DEFAULT_CM3 = 50;

const TABLE: VolumeEntry[] = [
  // ── compost / organics ────────────────────────────────────────────────
  { keywords: ["banana peel", "banana"],          cm3: 100 },
  { keywords: ["apple core", "apple"],            cm3: 80 },
  { keywords: ["coffee grounds", "coffee filter", "coffee"], cm3: 150 },
  { keywords: ["eggshell", "egg shell", "eggshells"], cm3: 30 },
  { keywords: ["orange peel", "orange"],          cm3: 110 },
  { keywords: ["tea bag", "tea"],                 cm3: 15 },
  { keywords: ["bread crust", "bread"],           cm3: 120 },
  { keywords: ["lettuce", "salad greens"],        cm3: 120 },
  { keywords: ["carrot peel", "carrot"],          cm3: 70 },
  { keywords: ["potato peel", "potato"],          cm3: 90 },
  { keywords: ["onion skin", "onion"],            cm3: 60 },
  { keywords: ["avocado pit"],                    cm3: 50 },
  { keywords: ["avocado peel", "avocado"],        cm3: 80 },
  { keywords: ["pineapple core", "pineapple"],    cm3: 150 },
  { keywords: ["watermelon rind", "watermelon"],  cm3: 500 },
  { keywords: ["melon rind", "melon"],            cm3: 400 },
  { keywords: ["corn cob"],                       cm3: 300 },
  { keywords: ["corn husk", "corn"],              cm3: 60 },
  { keywords: ["mango pit"],                      cm3: 60 },
  { keywords: ["mango peel", "mango"],            cm3: 110 },
  { keywords: ["peach pit", "peach"],             cm3: 40 },
  { keywords: ["broccoli stem", "broccoli"],      cm3: 120 },
  { keywords: ["cauliflower"],                    cm3: 120 },
  { keywords: ["spinach", "kale"],                cm3: 60 },
  { keywords: ["yogurt cup", "yogurt"],           cm3: 180 },  // spoiled yogurt → compost
  { keywords: ["food waste", "food_waste", "foodwaste", "food scrap"], cm3: 300 },
  { keywords: ["vegetable peel", "veggie peel"],  cm3: 80 },
  { keywords: ["fruit peel"],                     cm3: 80 },
  { keywords: ["meat scrap", "spoiled meat"],     cm3: 200 },
  { keywords: ["bone"],                           cm3: 60 },

  // ── recycle ───────────────────────────────────────────────────────────
  { keywords: ["aluminum can", "soda can", "beer can"], cm3: 360 },
  { keywords: ["plastic bottle", "water bottle"], cm3: 500 },
  { keywords: ["soda bottle", "2 liter"],         cm3: 2000 },
  { keywords: ["milk jug", "gallon jug"],         cm3: 3800 },
  { keywords: ["milk carton", "juice carton", "carton"], cm3: 950 },
  { keywords: ["pizza box"],                      cm3: 8000 },
  { keywords: ["shoe box"],                       cm3: 6000 },
  { keywords: ["cereal box"],                     cm3: 4000 },
  { keywords: ["cardboard box", "cardboard"],     cm3: 5000 },
  { keywords: ["wine bottle"],                    cm3: 750 },
  { keywords: ["beer bottle"],                    cm3: 330 },
  { keywords: ["glass bottle"],                   cm3: 500 },
  { keywords: ["glass jar", "mason jar", "jar"],  cm3: 500 },
  { keywords: ["newspaper"],                      cm3: 1000 },
  { keywords: ["magazine"],                       cm3: 500 },
  { keywords: ["envelope"],                       cm3: 25 },
  { keywords: ["printer paper", "office paper"],  cm3: 500 },
  { keywords: ["paperboard"],                     cm3: 500 },
  { keywords: ["cardboard tube", "paper towel roll"], cm3: 200 },
  { keywords: ["tin can", "food can", "soup can"], cm3: 400 },
  { keywords: ["detergent bottle"],               cm3: 1500 },
  { keywords: ["shampoo bottle"],                 cm3: 400 },
  { keywords: ["plastic container", "plastic tub"], cm3: 500 },
  { keywords: ["aluminum foil", "foil"],          cm3: 60 },
  { keywords: ["paper"],                          cm3: 100 },
  { keywords: ["plastic"],                        cm3: 300 }, // generic last-resort
  { keywords: ["bottle"],                         cm3: 500 }, // generic bottle

  // ── trash / landfill ─────────────────────────────────────────────────
  { keywords: ["candy wrapper", "wrapper"],       cm3: 8 },
  { keywords: ["chip bag", "snack bag"],          cm3: 500 },
  { keywords: ["plastic wrap", "saran wrap", "cling film"], cm3: 20 },
  { keywords: ["styrofoam"],                      cm3: 500 },
  { keywords: ["packing peanut"],                 cm3: 500 },
  { keywords: ["diaper"],                         cm3: 1000 },
  { keywords: ["paper towel"],                    cm3: 50 },
  { keywords: ["napkin"],                         cm3: 25 },
  { keywords: ["tissue"],                         cm3: 25 },
  { keywords: ["gum"],                            cm3: 5 },
  { keywords: ["cigarette"],                      cm3: 2 },
  { keywords: ["straw"],                          cm3: 5 },
  { keywords: ["bandage", "band-aid"],            cm3: 5 },
  { keywords: ["toothbrush"],                     cm3: 40 },
  { keywords: ["toothpaste"],                     cm3: 80 },
  { keywords: ["razor"],                          cm3: 30 },
  { keywords: ["broken glass", "ceramic"],        cm3: 150 },
  { keywords: ["plastic utensil", "plastic fork", "plastic spoon", "plastic knife"], cm3: 15 },
  { keywords: ["pen"],                            cm3: 12 },
  { keywords: ["pencil"],                         cm3: 10 },
  { keywords: ["dental floss", "floss"],          cm3: 30 },
  { keywords: ["receipt"],                        cm3: 8 },

  // ── electronic waste / e-waste ───────────────────────────────────────
  { keywords: ["aa battery"],                     cm3: 20 },
  { keywords: ["aaa battery"],                    cm3: 10 },
  { keywords: ["9v battery"],                     cm3: 50 },
  { keywords: ["lithium battery"],                cm3: 50 },
  { keywords: ["coin cell", "button cell"],       cm3: 5 },
  { keywords: ["battery", "batteries"],           cm3: 30 },
  { keywords: ["phone charger", "wall charger", "charger"], cm3: 150 },
  { keywords: ["usb cable", "usb-c cable"],       cm3: 60 },
  { keywords: ["ethernet cable"],                 cm3: 120 },
  { keywords: ["power cord", "extension cord"],   cm3: 200 },
  { keywords: ["cable", "cord", "wire"],          cm3: 80 },
  { keywords: ["earbuds", "earphones"],           cm3: 60 },
  { keywords: ["headphones", "headset"],          cm3: 350 },
  { keywords: ["smartphone", "cell phone", "phone"], cm3: 150 },
  { keywords: ["tablet", "ipad"],                 cm3: 600 },
  { keywords: ["laptop", "notebook computer"],    cm3: 2200 },
  { keywords: ["monitor", "display"],             cm3: 6000 },
  { keywords: ["keyboard"],                       cm3: 1000 },
  { keywords: ["mouse", "computer mouse"],        cm3: 150 },
  { keywords: ["remote control", "remote"],       cm3: 150 },
  { keywords: ["printer cartridge", "ink cartridge", "toner"], cm3: 200 },
  { keywords: ["circuit board", "motherboard"],   cm3: 500 },
  { keywords: ["fluorescent bulb", "cfl"],        cm3: 400 },
  { keywords: ["led bulb"],                       cm3: 120 },
  { keywords: ["light bulb", "bulb"],             cm3: 150 },
  { keywords: ["router", "wifi router", "modem"], cm3: 700 },
  { keywords: ["camera", "webcam"],               cm3: 300 },
  { keywords: ["speaker"],                        cm3: 800 },
  { keywords: ["electronics", "e-waste", "ewaste"], cm3: 500 },
];

/**
 * Look up estimated cm³ for an item name. Returns `DEFAULT_CM3` (50) when
 * nothing in the table matches — so the gauge never reads zero just because
 * we haven't seen this label before.
 */
export function lookupVolumeCm3(itemName: string | undefined | null): number {
  const lower = String(itemName ?? "").toLowerCase().trim();
  if (!lower) return DEFAULT_CM3;

  let bestLen = 0;
  let bestCm3 = DEFAULT_CM3;
  for (const entry of TABLE) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw) && kw.length > bestLen) {
        bestLen = kw.length;
        bestCm3 = entry.cm3;
      }
    }
  }
  return bestCm3;
}
