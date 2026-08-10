export type ColorDirection = {
  id: string;
  description: string;
  descriptions?: string[];
  words: string[];
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  second: string;
};

// Semantic color anchors. The descriptions help embedding search; words keep the offline fallback useful.
export const colorDirections: ColorDirection[] = [
  { id: 'sun', description: 'sun sunlight sunshine daylight bright warm glowing golden pale sky morning radiant open light', descriptions: ['bright yellow sunlight', 'warm golden daylight', 'a radiant morning sky', 'soft solar glow'], words: ['sun', 'sunlight', 'sunshine', 'daylight', 'sunny', 'radiant'], bg: '#f8edb8', surface: '#fffbe4', text: '#3d3214', muted: '#9b8545', accent: '#e2a51a', second: '#f6cf54' },
  { id: 'lemon', description: 'lemon yellow citrus sunlight bright spring gold banana cheerful', words: ['lemon', 'yellow', 'citrus', 'gold', 'banana'], bg: '#f1edbd', surface: '#fffbdc', text: '#35320f', muted: '#8f8952', accent: '#d0ad16', second: '#f1d94c' },
  { id: 'mustard', description: 'mustard ochre turmeric curry antique yellow earthy muted golden autumn', words: ['mustard', 'ochre', 'turmeric', 'curry'], bg: '#e8dfb9', surface: '#f5edca', text: '#3d351b', muted: '#887844', accent: '#a98718', second: '#c8ae45' },
  { id: 'gold', description: 'golden metallic luxury champagne brass treasure warm yellow elegant', words: ['gold', 'golden', 'champagne', 'brass', 'luxury'], bg: '#eee2b9', surface: '#faf2d4', text: '#3d321b', muted: '#95804d', accent: '#b9932e', second: '#dfbd5e' },
  { id: 'orange', description: 'orange amber terracotta fire autumn warmth pumpkin tangerine', words: ['orange', 'amber', 'terracotta', 'fire', 'pumpkin', 'tangerine'], bg: '#eee0c9', surface: '#faf0dc', text: '#3a281d', muted: '#92715a', accent: '#c86a2d', second: '#e3a34f' },
  { id: 'coral', description: 'coral salmon peach tropical warm orange pink soft sunset', words: ['coral', 'salmon', 'peach'], bg: '#f1ddd5', surface: '#fbeddf', text: '#402b28', muted: '#9c7770', accent: '#d86d5d', second: '#f0a27f' },
  { id: 'terracotta', description: 'terracotta clay brick adobe burnt orange desert pottery earthy', words: ['terracotta', 'clay', 'brick', 'adobe'], bg: '#ead7cc', surface: '#f5e7dc', text: '#402b28', muted: '#967469', accent: '#ad5138', second: '#cf8666' },
  { id: 'red', description: 'red crimson cherry scarlet passionate dramatic strong primary color', words: ['red', 'crimson', 'cherry', 'scarlet'], bg: '#eee0df', surface: '#f8e9e7', text: '#3b2526', muted: '#967272', accent: '#b34447', second: '#dd8e86' },
  { id: 'apple', description: 'red apple ripe fruit orchard fresh crisp red skin green leaf natural harvest', descriptions: ['ripe red fruit and green leaves', 'an apple orchard in spring', 'crisp red apple skin', 'a warm still life with fruit'], words: ['apple', 'ripe', 'orchard'], bg: '#eddddd', surface: '#f8ece6', text: '#3a2928', muted: '#967773', accent: '#bd3f3f', second: '#79a052' },
  { id: 'vermilion', description: 'vermilion vivid red orange lacquer signal energetic hot saturated', words: ['vermilion', 'signal', 'lacquer'], bg: '#f0d9d1', surface: '#fceddf', text: '#451f1c', muted: '#a16c62', accent: '#df3e25', second: '#f08043' },
  { id: 'rose', description: 'rose dusty pink romantic flower vintage red gentle', words: ['rose', 'flower', 'romantic'], bg: '#eddcdf', surface: '#f9ebee', text: '#3e2931', muted: '#987782', accent: '#b85873', second: '#d89aaa' },
  { id: 'pink', description: 'pink blush pastel cotton candy delicate playful sweet', words: ['pink', 'blush', 'pastel', 'cotton'], bg: '#f1dfe6', surface: '#fbedf1', text: '#3b2830', muted: '#9b7886', accent: '#c65c83', second: '#e8a6bd' },
  { id: 'magenta', description: 'magenta fuchsia hot pink vivid saturated pop electric', words: ['magenta', 'fuchsia'], bg: '#ead9e7', surface: '#f7eaf5', text: '#3c1c39', muted: '#956e91', accent: '#c92d96', second: '#e26bc0' },
  { id: 'plum', description: 'plum dark purple wine aubergine rich velvet moody', words: ['plum', 'aubergine', 'wine', 'velvet'], bg: '#e1d6e0', surface: '#f0e7ef', text: '#332335', muted: '#806d80', accent: '#71395f', second: '#a878a1' },
  { id: 'purple', description: 'purple violet royal ultraviolet mysterious saturated creative', words: ['purple', 'violet', 'ultraviolet', 'royal'], bg: '#e5dfed', surface: '#f2edf6', text: '#30283b', muted: '#81758e', accent: '#7655a8', second: '#c3a8e1' },
  { id: 'lavender', description: 'lavender lilac soft purple floral airy gentle pastel', words: ['lavender', 'lilac'], bg: '#e8e2ef', surface: '#f5f0f8', text: '#332e3c', muted: '#898097', accent: '#9376b5', second: '#c7b7db' },
  { id: 'blueberry', description: 'blueberry berry indigo blue purple violet fruit rich cool dark blue-violet', words: ['blueberry', 'berry', 'indigo'], bg: '#deddec', surface: '#efedf7', text: '#29233f', muted: '#77718e', accent: '#4d4ba8', second: '#9a75c7' },
  { id: 'navy', description: 'navy midnight deep blue ink ocean night serious elegant', words: ['navy', 'midnight', 'ink'], bg: '#202b3d', surface: '#2e3b52', text: '#edf1f4', muted: '#9ba8ba', accent: '#7d9fc9', second: '#4f668f' },
  { id: 'blue', description: 'blue sky ocean clear air cool water cobalt', words: ['blue', 'sky', 'ocean', 'cobalt'], bg: '#dce8e9', surface: '#edf5f5', text: '#183437', muted: '#6b8588', accent: '#247f89', second: '#8cc6d1' },
  { id: 'azure', description: 'azure clear blue summer sky bright open Mediterranean', words: ['azure', 'summer', 'mediterranean'], bg: '#dbeaf1', surface: '#edf7fb', text: '#173346', muted: '#6e8998', accent: '#268dcc', second: '#83c6e4' },
  { id: 'cerulean', description: 'cerulean blue vivid sky sea clean optimistic', words: ['cerulean'], bg: '#d7e9ee', surface: '#eaf6f8', text: '#17353d', muted: '#6b8991', accent: '#218aa4', second: '#7bc4d0' },
  { id: 'moon', description: 'moon moonlight lunar silver pale night sky cool blue grey quiet reflected light', descriptions: ['cool silver moonlight', 'pale blue-grey night', 'a quiet lunar sky', 'darkness with reflected light'], words: ['moon', 'lunar', 'moonlight', 'silver'], bg: '#202638', surface: '#30384d', text: '#edf1f5', muted: '#9da9bd', accent: '#b9c9e5', second: '#6d7da4' },
  { id: 'cyan', description: 'cyan aqua turquoise bright digital water clean blue-green', words: ['cyan', 'aqua', 'turquoise'], bg: '#d8eeee', surface: '#eaf8f7', text: '#173737', muted: '#668989', accent: '#159c9d', second: '#78d7d0' },
  { id: 'teal', description: 'teal deep sea jade mineral blue green muted sophisticated', words: ['teal', 'jade', 'mineral'], bg: '#d8e6e1', surface: '#eaf2ee', text: '#203834', muted: '#6b837c', accent: '#287c70', second: '#8bb9a5' },
  { id: 'emerald', description: 'emerald jewel green gemstone luxurious deep vivid forest', words: ['emerald', 'jewel'], bg: '#d9e6db', surface: '#eaf3e9', text: '#20352a', muted: '#6e8878', accent: '#19734c', second: '#62af7d' },
  { id: 'green', description: 'green forest leaf moss botanical nature frog frogs fresh meadow', words: ['green', 'forest', 'leaf', 'moss', 'frog'], bg: '#dfe6dc', surface: '#eef2e9', text: '#28372d', muted: '#718276', accent: '#397050', second: '#a8b984' },
  { id: 'olive', description: 'olive muted green military herb dry earth vintage subdued', words: ['olive', 'herb', 'military'], bg: '#e2e1cf', surface: '#f0efdd', text: '#343526', muted: '#7d7f63', accent: '#747d38', second: '#aeb36c' },
  { id: 'lime', description: 'lime chartreuse acid green electric yellow fresh energetic', words: ['lime', 'chartreuse', 'acid'], bg: '#e6ebc9', surface: '#f3f8dc', text: '#303817', muted: '#77834b', accent: '#79a51d', second: '#c9df3e' },
  { id: 'mint', description: 'mint pale green fresh cool clean spa soft pastel', words: ['mint'], bg: '#dcece3', surface: '#eff8f1', text: '#253a30', muted: '#718b7c', accent: '#45a77d', second: '#9bd5b3' },
  { id: 'brown', description: 'brown coffee chocolate leather earth walnut rustic grounded', words: ['brown', 'coffee', 'chocolate', 'leather', 'walnut'], bg: '#e6dbce', surface: '#f3e9dd', text: '#342820', muted: '#8d7665', accent: '#865336', second: '#bd8a5d' },
  { id: 'sienna', description: 'sienna umber rust clay earth pigment warm natural', words: ['sienna', 'umber', 'rust'], bg: '#e5d6c7', surface: '#f1e6d8', text: '#3b2b23', muted: '#8d7664', accent: '#995438', second: '#c28b61' },
  { id: 'cream', description: 'cream ivory beige vanilla parchment linen warm neutral', words: ['cream', 'ivory', 'beige', 'vanilla', 'linen'], bg: '#eee8d9', surface: '#faf6e9', text: '#38352b', muted: '#8d887a', accent: '#aa8d51', second: '#d8c89f' },
  { id: 'pearl', description: 'pearl white shell opal soft luminous neutral elegant', words: ['pearl', 'shell', 'opal'], bg: '#e9e8e1', surface: '#fbfaf4', text: '#353631', muted: '#898a80', accent: '#a59c8d', second: '#d6cfc1' },
  { id: 'charcoal', description: 'coal charcoal black graphite dark grey ash smoke neutral industrial stone, not green', words: ['coal', 'charcoal', 'graphite', 'slate', 'smoke', 'ash'], bg: '#292827', surface: '#383634', text: '#eee9df', muted: '#9a958b', accent: '#c2b59f', second: '#6e6860' },
  { id: 'silver', description: 'silver chrome steel metallic grey reflective cool modern industrial', words: ['silver', 'chrome', 'steel', 'metallic'], bg: '#dfe2e2', surface: '#f1f3f1', text: '#252a2d', muted: '#788185', accent: '#637b88', second: '#b3c0c2' },
  { id: 'black', description: 'black ink obsidian pitch dark elegant minimal high contrast', words: ['black', 'obsidian', 'pitch'], bg: '#171717', surface: '#252525', text: '#f1eee6', muted: '#9c9990', accent: '#d8d0bf', second: '#5e5c58' },
  { id: 'white', description: 'white snow pure blank bright minimal clean light', words: ['white', 'snow', 'pure', 'blank'], bg: '#f0f0ed', surface: '#ffffff', text: '#222321', muted: '#82847f', accent: '#50544e', second: '#c6c9c2' },
];
