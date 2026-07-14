export const PRODUCTS = [
  {
    id: 'babygirl',
    name: 'Babygirl',
    price: 28,
    size: '100ml / 3.4 fl.oz.',
    images: ['/images/si-babygirl-main.svg', '/images/si-babygirl-alt.svg', '/images/si-lifestyle-babygirl.svg'],
    category: 'body-mist',
    badge: 'Bestseller',
    tagline: 'milk · skin musk · marshmallow',
    description: 'Milk, skin musk, marshmallow. A scent from the cultural record, worn like a costume.',
    longDescription: 'The one everyone asks about. Babygirl is soft, milky, and a little too sweet on purpose — skin musk warmed by marshmallow and a splash of cream. It reads exactly like the character it borrows its name from: a little bit performance, a little bit comfort, entirely on purpose.',
    notes: {
      top: 'Milk · Cream accord',
      middle: 'Marshmallow · Soft musk',
      base: 'Skin musk · Warm sugar',
    },
    wear: 'Close-to-skin, all day',
    finish: 'Milky, sweet, a little bit much — in a good way',
  },
  {
    id: 'pilates-princess',
    name: 'Pilates Princess',
    price: 28,
    size: '100ml / 3.4 fl.oz.',
    images: ['/images/si-pilates-princess-main.svg', '/images/si-pilates-princess-alt.svg', '/images/si-lifestyle-pilates.svg'],
    category: 'body-mist',
    badge: '',
    tagline: 'matcha · lily · musk',
    description: 'Matcha, lily, musk. A scent from the cultural record, worn like a costume.',
    longDescription: 'Green juice, 6am reformer class, matching set. Pilates Princess opens with bittersweet matcha and cool lily, settling into a clean musk that reads more "wellness girl on the way to brunch" than actual gym. It is the scent of a routine you post about.',
    notes: {
      top: 'Matcha · Green tea leaf',
      middle: 'Lily · White petals',
      base: 'Clean musk',
    },
    wear: 'Close-to-skin, all day',
    finish: 'Crisp, green, effortlessly put-together',
  },
  {
    id: 'clean-rich',
    name: 'Clean Rich',
    price: 28,
    size: '100ml / 3.4 fl.oz.',
    images: ['/images/si-clean-rich-main.svg', '/images/si-clean-rich-alt.svg', '/images/si-lifestyle-clean-rich.svg'],
    category: 'body-mist',
    badge: 'New',
    tagline: 'bergamot · white tea · iris · musk',
    description: 'Bergamot, white tea, iris, musk. A scent from the cultural record, worn like a costume.',
    longDescription: 'Quiet luxury, but make it a body mist. Bergamot and white tea open bright and soaped-clean, iris and musk settle in soft and expensive-smelling. Clean Rich is the money that doesn’t shout — just lingers a little longer than everyone else’s.',
    notes: {
      top: 'Bergamot · White tea',
      middle: 'Iris',
      base: 'Soft musk',
    },
    wear: 'Close-to-skin, all day',
    finish: 'Soaped-clean, softly expensive',
  },
  {
    id: 'the-archive-trio',
    name: 'The Archive Trio',
    price: 72,
    size: '3 × 100ml',
    images: ['/images/si-archive-trio.svg'],
    category: 'set',
    badge: 'Save $12',
    tagline: 'babygirl · pilates princess · clean rich',
    description: 'All three characters, bundled and saved.',
    longDescription: 'Babygirl, Pilates Princess, and Clean Rich — the full archive in one set, so you’ve always got the right character for the day.',
    notes: null,
    wear: 'Three moods, one bag',
    finish: 'A scent for every era',
  },
];

// A checkout-only free-gift offer — deliberately not part of PRODUCTS so it
// never shows up in the shop grid or search; it's only ever added via the
// timed offer on the checkout page.
export const TASSEL_GIFT = {
  id: 'mini-spritz',
  name: 'Mini Spritz Keychain',
  price: 12,
  size: '10ml',
  images: ['/images/si-mini-spritz.svg'],
  category: 'gift',
};

export const getProductById = (id) => PRODUCTS.find((p) => p.id === id);
export const getProductsByCategory = (category) => PRODUCTS.filter((p) => p.category === category);
export const getFeaturedProducts = () => PRODUCTS.filter((p) => ['babygirl', 'pilates-princess', 'clean-rich'].includes(p.id));
