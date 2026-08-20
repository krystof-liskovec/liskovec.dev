const root = document.documentElement;
const form = document.querySelector<HTMLFormElement>('#theme-form');
const input = document.querySelector<HTMLInputElement>('#theme-prompt');
const status = document.querySelector<HTMLElement>('#prompt-status');
const reset = document.querySelector<HTMLButtonElement>('#reset-theme');
const undo = document.querySelector<HTMLButtonElement>('#undo-theme');

type AppliedTheme = {
  themeId: string;
  label: string;
  vars: Record<string, string>;
  shape: string;
  type: string;
  statusText?: string;
};

const themeHistory: AppliedTheme[] = [];
let currentTheme: AppliedTheme | null = null;
const BACKEND_URL = 'http://localhost:8080/api/theme';

function setAppliedTheme(theme: AppliedTheme, record = true) {
  if (record && currentTheme) themeHistory.push(currentTheme);
  currentTheme = theme;

  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }

  root.dataset.shape = theme.shape;
  root.dataset.type = theme.type;

  if (undo) undo.disabled = themeHistory.length === 0;
  if (status && theme.statusText) status.textContent = theme.statusText;
}

async function fetchThemeFromBackend(prompt: string): Promise<AppliedTheme> {
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  return response.json();
}

async function applyTheme(prompt = '') {
  const trimmed = prompt.trim();
  if (status) status.textContent = 'consulting the backend LLM...';

  try {
    const theme = await fetchThemeFromBackend(trimmed || 'quiet');
    setAppliedTheme(theme);
  } catch (error) {
    console.warn('Backend server unavailable, applying default theme.', error);
    setAppliedTheme({
      themeId: 'quiet',
      label: 'quiet / precise',
      vars: {
        '--bg': '#ebe8e0',
        '--surface': '#f4f1e9',
        '--text': '#242521',
        '--muted': '#77766e',
        '--accent': '#b85c3b',
        '--second': '#d5c3a5',
        '--radius': '2px',
      },
      shape: 'organic',
      type: 'serif',
      statusText: 'server offline (running fallback)',
    });
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  void applyTheme(input?.value || '');
});

document.querySelectorAll<HTMLButtonElement>('[data-prompt]').forEach((button) =>
  button.addEventListener('click', () => {
    if (input) input.value = button.dataset.prompt || '';
    void applyTheme(input?.value || '');
  })
);

undo?.addEventListener('click', () => {
  const previous = themeHistory.pop();
  if (!previous) return;
  setAppliedTheme(previous, false);
});

reset?.addEventListener('click', () => {
  if (input) input.value = '';
  void applyTheme('quiet');
});
