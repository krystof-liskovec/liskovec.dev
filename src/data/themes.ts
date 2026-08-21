export type Theme = {
  id: string;
  label: string;
  description: string;
  words: string[];
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  second: string;
  radius: number;
  shape: string;
  type: string;
};

export const themes: Theme[] = [
  { id: 'quiet', label: 'quiet / precise', description: 'quiet, precise, minimal, simple, calm, clean, understated, spacious, thoughtful', words: ['quiet', 'precise', 'minimal', 'simple', 'calm', 'clean'], bg: '#ebe8e0', surface: '#f4f1e9', text: '#242521', muted: '#77766e', accent: '#b85c3b', second: '#d5c3a5', radius: 2, shape: 'organic', type: 'serif' },
  { id: 'editorial', label: 'warm / editorial', description: 'warm editorial print design, nostalgic paper, coffee, analog, tactile, soft, literary, magazine', words: ['warm', 'editorial', 'nostalgic', 'coffee', 'paper', 'analog', 'soft'], bg: '#e9dfd2', surface: '#f5eee5', text: '#30241f', muted: '#8c7668', accent: '#b34e32', second: '#d09d67', radius: 10, shape: 'arch', type: 'serif' },
  { id: 'neon', label: 'neon / future', description: 'strange neon future, cyberpunk, electric night city, sharp technology, synthetic, glowing, digital', words: ['neon', 'future', 'cyberpunk', 'electric', 'futuristic', 'night', 'sharp'], bg: '#111217', surface: '#1c1e26', text: '#e8e8de', muted: '#858893', accent: '#d2f34b', second: '#9b7cff', radius: 0, shape: 'angular', type: 'mono' },
  { id: 'forest', label: 'organic / calm', description: 'organic calm forest nature botanical green rain garden, frog, frogs, moss, leaves, soft natural forms, quiet outdoors', words: ['organic', 'calm', 'forest', 'green', 'nature', 'botanical', 'rain'], bg: '#dfe6dc', surface: '#eef2e9', text: '#28372d', muted: '#718276', accent: '#397050', second: '#a8b984', radius: 28, shape: 'organic', type: 'sans' },
  { id: 'brutalist', label: 'soft brutalism', description: 'black and white brutalist graphic design, raw bold contrast, concrete, direct, architectural, stark', words: ['brutalist', 'brutalism', 'black', 'white', 'contrast', 'bold', 'raw'], bg: '#e7e7e2', surface: '#f6f6f1', text: '#111111', muted: '#6f6f6a', accent: '#ef4d2f', second: '#d9d900', radius: 0, shape: 'angular', type: 'sans' },
  { id: 'ocean', label: 'deep / oceanic', description: 'deep blue ocean, open sky, clouds, clear air, water, slow peaceful cool atmosphere, horizon', words: ['ocean', 'blue', 'sky', 'cloud', 'air', 'clear', 'deep', 'water', 'slow', 'peaceful', 'cool'], bg: '#dce8e9', surface: '#edf4f3', text: '#183437', muted: '#6b8588', accent: '#247f89', second: '#e39d70', radius: 18, shape: 'wave', type: 'sans' },
  { id: 'sunset', label: 'dusty / sunset', description: 'dusty sunset, orange pink dreamy romantic warm evening, faded film, soft horizon, nostalgic light', words: ['sunset', 'orange', 'pink', 'dreamy', 'warm', 'dusty', 'romantic'], bg: '#f0ddd8', surface: '#f8ebe4', text: '#38262d', muted: '#9c777a', accent: '#c45166', second: '#e6a14b', radius: 20, shape: 'blob', type: 'serif' },
  { id: 'mono', label: 'mono / direct', description: 'monochrome black white direct professional focused restrained typographic Swiss design, no decoration', words: ['monochrome', 'mono', 'direct', 'professional', 'black', 'white', 'focused'], bg: '#eeeeeb', surface: '#fafaf7', text: '#191919', muted: '#777774', accent: '#191919', second: '#b7b7b0', radius: 4, shape: 'line', type: 'mono' },
];
