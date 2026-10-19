export interface ReadingTheme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  background: string;
  foreground: string;
  accent: string;
  colors: string[];
}

const theme = (id: string, name: string, mode: 'light' | 'dark', background: string, foreground: string, accent: string, colors: string[]): ReadingTheme => ({ id, name, mode, background, foreground, accent, colors });

export const themes: ReadingTheme[] = [
  theme('paper', 'Paper', 'light', '#fffefa', '#242c29', '#315c4c', ['#739985', '#d6b77a', '#8c9cba']),
  theme('sepia', 'Sepia', 'light', '#f1e5cf', '#493d2e', '#756039', ['#a4775e', '#a89b68', '#7e9485']),
  theme('night', 'Night', 'dark', '#202823', '#d8dfd5', '#b2cbb5', ['#83ad98', '#c9b27e', '#9baec0']),
  theme('dracula', 'Dracula', 'dark', '#282a36', '#f8f8f2', '#bd93f9', ['#50fa7b', '#ff79c6', '#8be9fd']),
  theme('nord', 'Nord', 'dark', '#2e3440', '#d8dee9', '#88c0d0', ['#a3be8c', '#81a1c1', '#b48ead']),
  theme('gruvbox-dark', 'Gruvbox Dark', 'dark', '#282828', '#ebdbb2', '#ebdbb2', ['#98971a', '#458588', '#b16286']),
  theme('catppuccin-mocha', 'Catppuccin Mocha', 'dark', '#1e1e2e', '#cdd6f4', '#89b4fa', ['#a6e3a1', '#f5c2e7', '#94e2d5']),
  theme('catppuccin-macchiato', 'Catppuccin Macchiato', 'dark', '#24273a', '#cad3f5', '#8aadf4', ['#a6da95', '#f5bde6', '#8bd5ca']),
  theme('catppuccin-frappe', 'Catppuccin Frappé', 'dark', '#303446', '#c6d0f5', '#8caaee', ['#a6d189', '#f4b8e4', '#81c8be']),
  theme('tokyo-night', 'Tokyo Night', 'dark', '#1a1b26', '#c0caf5', '#7aa2f7', ['#9ece6a', '#bb9af7', '#7dcfff']),
  theme('one-dark', 'One Dark', 'dark', '#21252b', '#abb2bf', '#61afef', ['#98c379', '#c678dd', '#56b6c2']),
  theme('solarized-dark', 'Solarized Dark', 'dark', '#002b36', '#839496', '#839496', ['#859900', '#268bd2', '#d33682']),
  theme('rose-pine', 'Rosé Pine', 'dark', '#191724', '#e0def4', '#c4a7e7', ['#31748f', '#9ccfd8', '#ebbcba']),
  theme('kanagawa', 'Kanagawa Wave', 'dark', '#1f1f28', '#dcd7ba', '#7e9cd8', ['#76946a', '#957fb8', '#6a9589']),
  theme('everforest-dark', 'Everforest Dark', 'dark', '#232a2e', '#d3c6aa', '#a7c080', ['#7fbbb3', '#d699b6', '#83c092']),
  theme('catppuccin-latte', 'Catppuccin Latte', 'light', '#eff1f5', '#4c4f69', '#1e66f5', ['#40a02b', '#ea76cb', '#179299']),
  theme('gruvbox-light', 'Gruvbox Light', 'light', '#fbf1c7', '#3c3836', '#3c3836', ['#98971a', '#458588', '#b16286']),
  theme('solarized-light', 'Solarized Light', 'light', '#fdf6e3', '#657b83', '#657b83', ['#859900', '#268bd2', '#d33682']),
  theme('rose-pine-dawn', 'Rosé Pine Dawn', 'light', '#faf4ed', '#575279', '#575279', ['#286983', '#907aa9', '#d7827e']),
  theme('tokyo-night-day', 'Tokyo Night Day', 'light', '#e1e2e7', '#3760bf', '#2e7de9', ['#587539', '#9854f1', '#007197']),
  theme('one-light', 'One Light', 'light', '#f9f9f9', '#2a2c33', '#2f5af3', ['#3f953a', '#950095', '#3f953a']),
  theme('everforest-light', 'Everforest Light', 'light', '#efebd4', '#5c6a72', '#5c6a72', ['#9ab373', '#7fbbb3', '#d699b6']),
  theme('github-light', 'GitHub Light', 'light', '#ffffff', '#1f2328', '#0969da', ['#116329', '#8250df', '#1b7c83']),
];

export const getTheme = (id: string) => themes.find(entry => entry.id === id) || themes[0];

export function applyThemeTokens(id: string) {
  const current = getTheme(id);
  const root = document.documentElement;
  root.dataset.theme = current.id;
  root.dataset.mode = current.mode;
  root.style.colorScheme = current.mode;
  const mix = (first: string, percentage: number, second: string) => `color-mix(in srgb, ${first} ${percentage}%, ${second})`;
  const tokens: Record<string, string> = {
    surface: current.background, raised: mix(current.background, 94, current.foreground),
    stage: mix(current.background, 94, current.mode === 'dark' ? '#000000' : current.foreground),
    ink: current.foreground, muted: mix(current.foreground, 83, current.background),
    accent: current.accent, 'accent-soft': mix(current.accent, 14, current.background),
    line: mix(current.foreground, 16, current.background),
    'ambient-mint': mix(current.accent, 12, 'transparent'), 'ambient-gold': mix(current.colors[1], 8, 'transparent'),
  };
  Object.entries(tokens).forEach(([name, value]) => root.style.setProperty(`--${name}`, value));
}
