/**
 * CHK-02: pre-loaded starter templates the user can seed a category from,
 * then freely edit. Packing templates are grouped by common trip type per
 * the spec; grocery has a single starter list since it doesn't vary by
 * trip type the way packing does.
 */
export const PACKING_TEMPLATES: Record<string, string[]> = {
  General: [
    'Passport / ID',
    'Phone charger',
    'First-aid kit',
    'Reusable water bottle',
    'Weather-appropriate layers',
  ],
  Beach: [
    'Swimsuit',
    'Sunscreen (SPF 50+)',
    'Beach towel',
    'Flip-flops / sandals',
    'Waterproof phone pouch',
    'Sun hat',
  ],
  Camping: [
    'Tent',
    'Sleeping bag',
    'Headlamp / flashlight',
    'Camp stove',
    'Insect repellent',
    'Multi-tool',
  ],
  'Winter Sports': [
    'Thermal base layers',
    'Waterproof gloves',
    'Ski/snowboard goggles',
    'Wool socks',
    'Hand warmers',
    'Lip balm with SPF',
  ],
  Backpacking: [
    'Backpack rain cover',
    'Water purification tablets',
    'Lightweight sleeping pad',
    'Trekking poles',
    'Portable power bank',
    'Compact first-aid kit',
  ],
};

export const GROCERY_TEMPLATE = [
  'Water (2L per person/day)',
  'Trail snacks',
  'Breakfast items',
  'Sunscreen',
];

// Kept for backward compatibility with any existing references.
export const PACKING_TEMPLATE = PACKING_TEMPLATES.General;
