export type PromptEvaluation = {
  prompt: string;
  expectedDirections: string[];
  expectedColors: string[];
};

// Small regression set for checking semantic ranking when direction data changes.
export const promptEvaluations: PromptEvaluation[] = [
  { prompt: 'a melancholic moonlit concrete structure', expectedDirections: ['moon', 'moonlight', 'melancholic', 'concrete'], expectedColors: ['blue', 'charcoal', 'silver'] },
  { prompt: 'a ripe apple in a quiet orchard', expectedDirections: ['apple', 'calm', 'organic'], expectedColors: ['apple', 'red', 'green'] },
  { prompt: 'bright sunlight on a warm paper poster', expectedDirections: ['sun', 'daylight', 'paper'], expectedColors: ['sun', 'lemon', 'gold'] },
  { prompt: 'a playful glass house by the ocean', expectedDirections: ['playful', 'glass', 'ocean'], expectedColors: ['blue', 'cyan', 'azure'] },
  { prompt: 'old copper machinery in a dark room', expectedDirections: ['metal', 'technical', 'candlelight'], expectedColors: ['orange', 'brown', 'charcoal'] },
  { prompt: 'a calm green frog after rain', expectedDirections: ['frog', 'calm', 'forest'], expectedColors: ['green', 'mint', 'teal'] },
  { prompt: 'dreamy blueberry velvet', expectedDirections: ['blueberry', 'velvet', 'dreamy'], expectedColors: ['blueberry', 'purple', 'violet'] },
];
