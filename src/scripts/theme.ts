import { pipeline } from '@huggingface/transformers';
import { colorDirections, type ColorDirection } from '../data/color-directions.ts';
import { themes, type Theme } from '../data/themes.ts';
import { visualDirections, type VisualDirection } from '../data/visual-directions.ts';

const root = document.documentElement;
const form = document.querySelector<HTMLFormElement>('#theme-form');
const input = document.querySelector<HTMLInputElement>('#theme-prompt');
const status = document.querySelector<HTMLElement>('#prompt-status');
const reset = document.querySelector<HTMLButtonElement>('#reset-theme');
const undo = document.querySelector<HTMLButtonElement>('#undo-theme');
let embedderPromise: ReturnType<typeof pipeline> | undefined;
const VECTOR_CACHE_KEY = 'liskovec-theme-vectors-minilm-v3';
const vectorCache = new Map<string, number[]>(Object.entries(JSON.parse(localStorage.getItem(VECTOR_CACHE_KEY) || '{}')));
const themeHistory: AppliedTheme[] = [];
let currentTheme: AppliedTheme | null = null;

const hexToRgb = (hex: string) => hex.match(/\w\w/g)!.map((value) => parseInt(value, 16));
const mixColor = (a: string, b: string, weight: number) => `#${hexToRgb(a).map((value, index) => Math.round(value * (1 - weight) + hexToRgb(b)[index] * weight).toString(16).padStart(2, '0')).join('')}`;
const fallbackScore = (prompt: string, item: { words: string[] }) => item.words.reduce((score, word) => score + (prompt.toLowerCase().includes(word) ? 1 : 0), 0);
const descriptionsFor = (item: { description: string; descriptions?: string[] }) => [item.description, ...(item.descriptions || [])];

type AppliedTheme = { vars: Record<string, string>; shape: string; type: string };

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, x, 0] : segment < 2 ? [x, chroma, 0] : segment < 3 ? [0, chroma, x] : segment < 4 ? [0, x, chroma] : segment < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const match = lightness - chroma / 2;
  return `#${[red, green, blue].map((value) => Math.round((value + match) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function generatePalette(prompt: string, selections: VisualDirection[] = []) {
  // A stable hue gives every unfamiliar prompt its own palette without shipping another model.
  let hash = 2166136261;
  for (const character of prompt.toLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const generatedHue = Math.abs(hash) % 360;
  const directionHue = selections.length ? selections.reduce((sum, direction) => sum + direction.hueShift, 0) / selections.length : generatedHue;
  const hue = (generatedHue * 0.55 + directionHue * 0.45) % 360;
  const generatedSaturation = 0.28 + (Math.abs(hash >> 8) % 22) / 100;
  const directionSaturation = selections.length ? selections.reduce((sum, direction) => sum + direction.saturation, 0) / selections.length : generatedSaturation;
  const saturation = generatedSaturation * 0.55 + directionSaturation * 0.45;
  const accentHue = (hue + 22 + (Math.abs(hash >> 16) % 38)) % 360;
  return {
    bg: hslToHex(hue, saturation, 0.9),
    surface: hslToHex(hue, Math.min(saturation + 0.04, 0.55), 0.96),
    text: hslToHex(hue, Math.min(saturation + 0.08, 0.62), 0.2),
    muted: hslToHex(hue, Math.min(saturation, 0.45), 0.48),
    accent: hslToHex(accentHue, Math.min(saturation + 0.24, 0.82), 0.43),
    second: hslToHex((hue + 190) % 360, Math.min(saturation + 0.12, 0.7), 0.62),
  };
}

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
  }
  return embedderPromise;
}

async function getVector(embedder: Awaited<ReturnType<typeof getEmbedder>>, text: string, kind: 'query' | 'document') {
  const cacheKey = `${kind}:${text}`;
  if (vectorCache.has(cacheKey)) return vectorCache.get(cacheKey)!;
  const preparedText = kind === 'query'
    ? `Represent this sentence for searching a visual design palette: ${text}`
    : `Represent this visual design direction for semantic search: ${text}`;
  const output = await embedder(preparedText, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data);
  vectorCache.set(cacheKey, vector);
  localStorage.setItem(VECTOR_CACHE_KEY, JSON.stringify(Object.fromEntries(vectorCache)));
  return vector;
}

async function semanticScore(embedder: Awaited<ReturnType<typeof getEmbedder>>, prompt: string, promptVector: number[], item: { description: string; descriptions?: string[]; words: string[] }, lexicalWeight: number) {
  const scores = await Promise.all(descriptionsFor(item).map(async (description) => cosineSimilarity(promptVector, await getVector(embedder, description, 'document'))));
  return Math.max(...scores) + fallbackScore(prompt, item) * lexicalWeight;
}

function cosineSimilarity(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function luminance(hex: string) {
  return hexToRgb(hex).map((value) => value / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function readableColor(foreground: string, background: string, minimum: number) {
  if (contrastRatio(foreground, background) >= minimum) return foreground;
  const original = hexToHsl(foreground);
  const backgroundIsLight = luminance(background) > 0.45;
  let candidate = original;
  for (let step = 1; step <= 12; step += 1) {
    candidate = {
      ...original,
      lightness: backgroundIsLight ? original.lightness - step * 0.055 : original.lightness + step * 0.055,
    };
    const adjusted = hslToHex(candidate.hue, candidate.saturation, Math.max(0.06, Math.min(0.94, candidate.lightness)));
    if (contrastRatio(adjusted, background) >= minimum) return adjusted;
  }
  return backgroundIsLight ? '#20211f' : '#f5f2e9';
}

function hexToHsl(hex: string) {
  const [red, green, blue] = hexToRgb(hex).map((value) => value / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return { hue: hue * 60, saturation, lightness };
}

function transformColor(hex: string, transform: (color: { hue: number; saturation: number; lightness: number }) => { hue: number; saturation: number; lightness: number }) {
  const color = transform(hexToHsl(hex));
  return hslToHex((color.hue + 360) % 360, Math.max(0, Math.min(1, color.saturation)), Math.max(0.08, Math.min(0.94, color.lightness)));
}

function applyAdjustment(prompt: string) {
  if (!currentTheme) return false;
  const query = prompt.toLowerCase();
  const hasAdjustment = /(more|less|make|keep|same|warmer|cooler|lighter|darker|saturated)/.test(query);
  if (!hasAdjustment) return false;
  let hueTarget: number | null = null;
  if (/(blue|cyan|ocean|cool)/.test(query)) hueTarget = 205;
  if (/(purple|violet|lavender)/.test(query)) hueTarget = 275;
  if (/(green|forest|mint)/.test(query)) hueTarget = 125;
  if (/(yellow|lemon|gold|sun)/.test(query)) hueTarget = 48;
  if (/(orange|amber|warm)/.test(query)) hueTarget = 28;
  if (/(red|pink|rose)/.test(query)) hueTarget = 350;
  const saturationChange = query.includes('less saturated') || query.includes('desaturated') ? 0.7 : query.includes('more saturated') || query.includes('vivid') ? 1.25 : 1;
  const lightnessChange = query.includes('lighter') || query.includes('brighter') ? 0.1 : query.includes('darker') || query.includes('deeper') ? -0.1 : 0;
  const vars = Object.fromEntries(Object.entries(currentTheme.vars).map(([key, value]) => {
    if (!value.startsWith('#')) return [key, value];
    return [key, transformColor(value, (color) => ({
      hue: hueTarget === null ? color.hue : color.hue + (hueTarget - color.hue) * 0.35,
      saturation: color.saturation * saturationChange,
      lightness: color.lightness + lightnessChange,
    }))];
  }));
  setAppliedTheme({ ...currentTheme, vars }, true);
  if (status) status.textContent = 'adjusted current visual';
  return true;
}

function setAppliedTheme(theme: AppliedTheme, recordHistory = true) {
  if (recordHistory && currentTheme) themeHistory.push(currentTheme);
  currentTheme = theme;
  root.classList.remove('theme-changing');
  void root.offsetWidth;
  root.classList.add('theme-changing');
  Object.entries(theme.vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.shape = theme.shape;
  root.dataset.type = theme.type;
  window.setTimeout(() => root.classList.remove('theme-changing'), 900);
  if (undo) undo.disabled = themeHistory.length === 0;
}

function blendColorDirections(matches: { direction: ColorDirection; score: number }[]) {
  if (!matches.length) return null;
  const strongest = matches[0].score;
  const weighted = matches.map((match) => ({ ...match, weight: Math.exp((match.score - strongest) * 8) }));
  const total = weighted.reduce((sum, match) => sum + match.weight, 0);
  const weightedColor = (property: keyof Pick<ColorDirection, 'bg' | 'surface' | 'text' | 'muted' | 'accent' | 'second'>) => {
    const rgb = weighted.reduce((sum, match) => {
      const color = hexToRgb(match.direction[property]);
      return sum.map((value, index) => value + color[index] * match.weight);
    }, [0, 0, 0]);
    return `#${rgb.map((value) => Math.round(value / total).toString(16).padStart(2, '0')).join('')}`;
  };
  const primary = matches[0].direction;
  return {
    ...primary,
    id: weighted.map((match) => match.direction.id).join(' + '),
    bg: weightedColor('bg'),
    surface: weightedColor('surface'),
    text: weightedColor('text'),
    muted: weightedColor('muted'),
    accent: weightedColor('accent'),
    second: weightedColor('second'),
  };
}

function applyThemeFromScores(ranked: { theme: Theme; score: number }[], palette: ColorDirection | null, generatedPalette: ReturnType<typeof generatePalette> | null, generatedWeight: number, selections: VisualDirection[] = []) {
  ranked.sort((a, b) => b.score - a.score);
  const first = ranked[0].score ? ranked[0] : { theme: themes[0], score: 1 };
  const second = ranked.find((item) => item.theme.id !== first.theme.id && item.score > 0) || { theme: themes[1], score: 0 };
  const total = first.score + second.score;
  const weight = total ? second.score / total : 0;
  const a = first.theme;
  const b = second.theme;
  const themeColors = { bg: mixColor(a.bg, b.bg, weight), surface: mixColor(a.surface, b.surface, weight), text: mixColor(a.text, b.text, weight), muted: mixColor(a.muted, b.muted, weight), accent: mixColor(a.accent, b.accent, weight), second: mixColor(a.second, b.second, weight) };
  const paletteWeight = palette ? 0.82 : generatedPalette ? 1 : 0;
  const semanticPalette = palette ? {
    bg: mixColor(palette.bg, generatedPalette?.bg || palette.bg, generatedWeight),
    surface: mixColor(palette.surface, generatedPalette?.surface || palette.surface, generatedWeight),
    text: mixColor(palette.text, generatedPalette?.text || palette.text, generatedWeight),
    muted: mixColor(palette.muted, generatedPalette?.muted || palette.muted, generatedWeight),
    accent: mixColor(palette.accent, generatedPalette?.accent || palette.accent, generatedWeight),
    second: mixColor(palette.second, generatedPalette?.second || palette.second, generatedWeight),
  } : generatedPalette;
  const vars = {
    '--bg': semanticPalette ? mixColor(themeColors.bg, semanticPalette.bg, paletteWeight) : themeColors.bg,
    '--surface': semanticPalette ? mixColor(themeColors.surface, semanticPalette.surface, paletteWeight) : themeColors.surface,
    '--text': semanticPalette ? mixColor(themeColors.text, semanticPalette.text, paletteWeight) : themeColors.text,
    '--muted': semanticPalette ? mixColor(themeColors.muted, semanticPalette.muted, paletteWeight) : themeColors.muted,
    '--accent': semanticPalette ? mixColor(themeColors.accent, semanticPalette.accent, paletteWeight) : themeColors.accent,
    '--second': semanticPalette ? mixColor(themeColors.second, semanticPalette.second, paletteWeight) : themeColors.second,
    '--radius': `${Math.round(a.radius * (1 - weight) + b.radius * weight)}px`,
  };
  const styleDirection = selections.find((direction) => direction.category === 'style');
  const shapeDirection = styleDirection || selections.find((direction) => direction.category === 'material');
  const shape = shapeDirection?.shape || (weight > 0.42 ? b.shape : a.shape);
  const type = styleDirection?.type || (weight > 0.55 ? b.type : a.type);
  const directionRadius = styleDirection?.radius ?? selections.find((direction) => direction.category === 'mood')?.radius;
  if (directionRadius !== undefined) root.style.setProperty('--radius', `${directionRadius}px`);
  vars['--text'] = readableColor(vars['--text'], vars['--bg'], 4.5);
  vars['--text'] = readableColor(vars['--text'], vars['--surface'], 4.5);
  vars['--muted'] = readableColor(vars['--muted'], vars['--bg'], 3);
  vars['--muted'] = readableColor(vars['--muted'], vars['--surface'], 3);
  vars['--accent'] = readableColor(vars['--accent'], vars['--bg'], 3);
  vars['--accent'] = readableColor(vars['--accent'], vars['--surface'], 3);
  vars['--second'] = readableColor(vars['--second'], vars['--bg'], 2.5);
  setAppliedTheme({ vars, shape, type });
  if (status) status.textContent = `${weight > 0.08 ? `blend: ${a.id} + ${b.id}` : `theme: ${a.label}`} / color: ${palette?.id || 'generated'}`;
}

function getFallbackDirections(prompt: string) {
  return (['subject', 'lighting', 'material', 'mood', 'style'] as const)
    .map((category) => [...visualDirections]
      .filter((direction) => direction.category === category)
      .sort((a, b) => fallbackScore(prompt, b) - fallbackScore(prompt, a))[0])
    .filter((direction) => fallbackScore(prompt, direction) > 0);
}

function applyFallbackTheme(prompt = '') {
  const ranked = themes.map((theme, index) => ({ theme, score: fallbackScore(prompt, theme) + (index === 0 ? 0.1 : 0) }));
  const palette = [...colorDirections].sort((a, b) => fallbackScore(prompt, b) - fallbackScore(prompt, a))[0];
  const exactPalette = fallbackScore(prompt, palette) > 0 ? palette : null;
  const selections = getFallbackDirections(prompt);
  applyThemeFromScores(ranked, exactPalette, prompt ? generatePalette(prompt, selections) : null, exactPalette ? 0.18 : 0.45, selections);
}

async function applyTheme(prompt = '') {
  if (!prompt.trim()) {
    applyFallbackTheme();
    return;
  }
  if (applyAdjustment(prompt)) return;
  if (status) status.textContent = 'reading the atmosphere...';
  try {
    const embedder = await getEmbedder();
    const promptVector = await getVector(embedder, prompt, 'query');
    const normalizedPrompt = prompt.toLowerCase();
    const exactPalette = colorDirections.find((direction) => direction.words.some((word) => normalizedPrompt.includes(word)));
    const [ranked, palettes, directionMatches] = await Promise.all([
      Promise.all(themes.map(async (theme) => ({ theme, score: await semanticScore(embedder, prompt, promptVector, theme, 0.15) }))),
      Promise.all(colorDirections.map(async (direction) => ({ direction, score: await semanticScore(embedder, prompt, promptVector, direction, 0.8) }))),
      Promise.all(visualDirections.map(async (direction) => ({ direction, score: await semanticScore(embedder, prompt, promptVector, direction, direction.category === 'subject' || direction.category === 'lighting' ? 0.8 : 0.45) }))),
    ]);
    palettes.sort((a, b) => b.score - a.score);
    const selections = (['subject', 'lighting', 'material', 'mood', 'style'] as const)
      .map((category) => directionMatches.filter((match) => match.direction.category === category).sort((a, b) => b.score - a.score)[0]?.direction)
      .filter((direction): direction is VisualDirection => Boolean(direction));
    const selectedPalette = exactPalette || blendColorDirections(palettes.slice(0, 3)) || null;
    applyThemeFromScores(ranked, selectedPalette, generatePalette(prompt, selections), exactPalette ? 0.18 : 0.45, selections);
  } catch (error) {
    console.warn('Semantic theme matching unavailable; using local fallback.', error);
    applyFallbackTheme(prompt);
  }
}

form?.addEventListener('submit', (event) => { event.preventDefault(); void applyTheme(input?.value || ''); });
document.querySelectorAll<HTMLButtonElement>('[data-prompt]').forEach((button) => button.addEventListener('click', () => { if (input) input.value = button.dataset.prompt || ''; void applyTheme(input?.value || ''); }));
undo?.addEventListener('click', () => {
  const previous = themeHistory.pop();
  if (!previous) return;
  setAppliedTheme(previous, false);
  if (status) status.textContent = 'undid visual change';
});
reset?.addEventListener('click', () => { themeHistory.length = 0; currentTheme = null; if (input) input.value = ''; applyFallbackTheme(); });
applyFallbackTheme();
