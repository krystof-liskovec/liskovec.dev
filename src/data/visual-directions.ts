export type DirectionCategory = 'subject' | 'lighting' | 'material' | 'mood' | 'style';

export type VisualDirection = {
  id: string;
  category: DirectionCategory;
  description: string;
  descriptions?: string[];
  words: string[];
  hueShift: number;
  saturation: number;
  lightness: number;
  radius: number;
  shape: string;
  type: string;
};

export const visualDirections: VisualDirection[] = [
  { id: 'moon', category: 'subject', description: 'moon lunar night sky silver sphere pale reflected light crater', descriptions: ['a cool silver moon in a dark sky', 'pale reflected lunar light', 'a quiet moonlit landscape', 'grey craters and deep night'], words: ['moon', 'lunar', 'crater'], hueShift: 220, saturation: 0.2, lightness: 0.34, radius: 50, shape: 'blob', type: 'serif' },
  { id: 'apple', category: 'subject', description: 'ripe red apple orchard fruit green leaf crisp harvest', descriptions: ['a ripe red apple with a green leaf', 'fresh fruit in an orchard', 'crisp red skin and spring green', 'an old still life with apples'], words: ['apple', 'orchard', 'fruit'], hueShift: 4, saturation: 0.62, lightness: 0.5, radius: 24, shape: 'organic', type: 'serif' },
  { id: 'sun', category: 'subject', description: 'sun solar daylight golden bright warm radiant sphere', descriptions: ['bright golden sunlight', 'a radiant sun in a clear sky', 'warm morning light', 'a glowing yellow solar disc'], words: ['sun', 'solar', 'sunshine'], hueShift: 44, saturation: 0.72, lightness: 0.62, radius: 50, shape: 'blob', type: 'sans' },
  { id: 'frog', category: 'subject', description: 'frog green amphibian wet meadow lily pond fresh nature', descriptions: ['a green frog near a lily pond', 'wet moss and fresh meadow green', 'a small amphibian in a rainy forest', 'bright natural spring foliage'], words: ['frog', 'amphibian', 'pond'], hueShift: 112, saturation: 0.52, lightness: 0.5, radius: 28, shape: 'organic', type: 'sans' },
  { id: 'ocean', category: 'subject', description: 'ocean sea water waves horizon deep blue open space', words: ['ocean', 'sea', 'waves', 'horizon'], hueShift: 195, saturation: 0.55, lightness: 0.43, radius: 22, shape: 'wave', type: 'sans' },
  { id: 'forest', category: 'subject', description: 'forest trees leaves moss woodland green botanical outdoors', words: ['forest', 'trees', 'woodland', 'moss'], hueShift: 125, saturation: 0.4, lightness: 0.35, radius: 30, shape: 'organic', type: 'serif' },
  { id: 'daylight', category: 'lighting', description: 'clear daylight bright morning sunlight open high key illumination', words: ['daylight', 'morning', 'bright'], hueShift: 48, saturation: 0.55, lightness: 0.78, radius: 8, shape: 'arch', type: 'sans' },
  { id: 'moonlight', category: 'lighting', description: 'cool moonlight pale silver blue night low light quiet glow', descriptions: ['cold blue light at night', 'soft silver illumination', 'a dark room lit by the moon', 'quiet reflected light after sunset'], words: ['moonlight', 'silver', 'night'], hueShift: 220, saturation: 0.25, lightness: 0.28, radius: 16, shape: 'blob', type: 'serif' },
  { id: 'neon-light', category: 'lighting', description: 'neon glow electric ultraviolet nightclub vivid artificial colored light', words: ['neon', 'glow', 'ultraviolet', 'electric'], hueShift: 285, saturation: 0.85, lightness: 0.48, radius: 0, shape: 'angular', type: 'mono' },
  { id: 'candlelight', category: 'lighting', description: 'candlelight amber flame intimate warm low light fire glow', words: ['candle', 'flame', 'candlelight'], hueShift: 28, saturation: 0.7, lightness: 0.45, radius: 12, shape: 'arch', type: 'serif' },
  { id: 'overcast', category: 'lighting', description: 'overcast cloudy grey soft diffused rainy muted flat daylight', words: ['overcast', 'cloudy', 'diffused'], hueShift: 205, saturation: 0.12, lightness: 0.58, radius: 6, shape: 'wave', type: 'sans' },
  { id: 'paper', category: 'material', description: 'paper parchment book page matte fiber editorial tactile ivory', words: ['paper', 'parchment', 'page', 'book'], hueShift: 38, saturation: 0.22, lightness: 0.84, radius: 2, shape: 'arch', type: 'serif' },
  { id: 'concrete', category: 'material', description: 'concrete cement brutalist stone raw grey architectural heavy', descriptions: ['raw grey concrete architecture', 'heavy cement and brutalist stone', 'unfinished industrial walls', 'dusty mineral surfaces'], words: ['concrete', 'cement', 'stone'], hueShift: 205, saturation: 0.08, lightness: 0.42, radius: 0, shape: 'angular', type: 'sans' },
  { id: 'glass', category: 'material', description: 'glass transparent translucent reflection clean modern cyan surface', words: ['glass', 'transparent', 'reflection'], hueShift: 190, saturation: 0.32, lightness: 0.72, radius: 18, shape: 'wave', type: 'sans' },
  { id: 'wood', category: 'material', description: 'wood grain oak walnut natural brown warm handmade organic', words: ['wood', 'grain', 'oak', 'walnut'], hueShift: 28, saturation: 0.42, lightness: 0.42, radius: 10, shape: 'organic', type: 'serif' },
  { id: 'metal', category: 'material', description: 'chrome steel metal machine silver industrial precise reflective', words: ['metal', 'chrome', 'steel', 'machine'], hueShift: 200, saturation: 0.16, lightness: 0.55, radius: 0, shape: 'angular', type: 'mono' },
  { id: 'velvet', category: 'material', description: 'velvet fabric rich soft deep jewel color luxurious tactile', words: ['velvet', 'fabric', 'luxurious'], hueShift: 315, saturation: 0.5, lightness: 0.3, radius: 18, shape: 'blob', type: 'serif' },
  { id: 'calm', category: 'mood', description: 'calm quiet peaceful slow spacious gentle contemplative', descriptions: ['quiet and spacious', 'peaceful like still water', 'slow, gentle, and contemplative', 'a calm breath of fresh air'], words: ['calm', 'quiet', 'peaceful', 'slow'], hueShift: 175, saturation: 0.18, lightness: 0.78, radius: 24, shape: 'wave', type: 'sans' },
  { id: 'melancholic', category: 'mood', description: 'melancholic lonely wistful introspective sad beautiful subdued', descriptions: ['beautiful loneliness', 'a wistful rainy afternoon', 'quiet sadness and memory', 'subdued, blue, introspective feeling'], words: ['melancholic', 'lonely', 'wistful', 'sad'], hueShift: 228, saturation: 0.28, lightness: 0.35, radius: 8, shape: 'line', type: 'serif' },
  { id: 'playful', category: 'mood', description: 'playful cheerful happy fun colorful friendly optimistic', words: ['playful', 'cheerful', 'happy', 'fun'], hueShift: 48, saturation: 0.75, lightness: 0.65, radius: 30, shape: 'blob', type: 'sans' },
  { id: 'energetic', category: 'mood', description: 'energetic intense bold loud dynamic fast vivid active', words: ['energetic', 'intense', 'bold', 'loud'], hueShift: 8, saturation: 0.85, lightness: 0.5, radius: 0, shape: 'angular', type: 'mono' },
  { id: 'dreamy', category: 'mood', description: 'dreamy soft surreal floating magical hazy romantic', words: ['dreamy', 'surreal', 'magical', 'hazy'], hueShift: 275, saturation: 0.38, lightness: 0.7, radius: 36, shape: 'blob', type: 'serif' },
  { id: 'editorial', category: 'style', description: 'editorial magazine typography literary art direction refined print', descriptions: ['a refined literary magazine', 'quiet printed pages and careful typography', 'art direction for an independent journal', 'warm paper and editorial whitespace'], words: ['editorial', 'magazine', 'literary', 'print'], hueShift: 25, saturation: 0.25, lightness: 0.72, radius: 4, shape: 'arch', type: 'serif' },
  { id: 'brutalist', category: 'style', description: 'brutalist raw stark black white architectural direct graphic', words: ['brutalist', 'stark', 'architectural', 'raw'], hueShift: 0, saturation: 0.05, lightness: 0.25, radius: 0, shape: 'angular', type: 'sans' },
  { id: 'organic', category: 'style', description: 'organic natural soft rounded botanical flowing asymmetrical', words: ['organic', 'natural', 'rounded', 'botanical'], hueShift: 115, saturation: 0.32, lightness: 0.7, radius: 30, shape: 'organic', type: 'sans' },
  { id: 'technical', category: 'style', description: 'technical precise digital interface grid system code futuristic', words: ['technical', 'digital', 'grid', 'system', 'code'], hueShift: 195, saturation: 0.65, lightness: 0.3, radius: 0, shape: 'angular', type: 'mono' },
  { id: 'retro', category: 'style', description: 'retro vintage analog seventies eighties poster nostalgic playful', words: ['retro', 'vintage', 'analog', 'seventies'], hueShift: 28, saturation: 0.58, lightness: 0.58, radius: 8, shape: 'arch', type: 'serif' },
];
