export const paletteSource = 'https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/ghostty';
export const paletteRetrieved = '2026-10-19';

export const terminalPalettes: Readonly<Record<string, readonly string[]>> = {
  dracula: ['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2', '#6272a4', '#ff6e6e', '#69ff94', '#ffffa5', '#d6acff', '#ff92df', '#a4ffff', '#ffffff'],
  nord: ['#3b4252', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0', '#596377', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#8fbcbb', '#eceff4'],
  'gruvbox-dark': ['#282828', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#a89984', '#928374', '#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#8ec07c', '#ebdbb2'],
  'catppuccin-mocha': ['#45475a', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#bac2de', '#585b70', '#f7aec2', '#c2ecbf', '#fcd682', '#aeccfc', '#f398da', '#b1eae1', '#a6adc8'],
  'catppuccin-macchiato': ['#494d64', '#ed8796', '#a6da95', '#eed49f', '#8aadf4', '#f5bde6', '#8bd5ca', '#b8c0e0', '#5b6078', '#f2a7b2', '#bde3b0', '#f4e3c1', '#adc5f7', '#f493da', '#a5ded6', '#a5adcb'],
  'catppuccin-frappe': ['#51576d', '#e78284', '#a6d189', '#e5c890', '#8caaee', '#f4b8e4', '#81c8be', '#b5bfe2', '#626880', '#eda0a2', '#b9dba2', '#ecd7ae', '#adc2f3', '#f38ed8', '#98d2ca', '#a5adce'],
  'tokyo-night': ['#15161e', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#a9b1d6', '#414868', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#c0caf5'],
  'one-dark': ['#21252b', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#abb2bf', '#767676', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#abb2bf'],
  'solarized-dark': ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5', '#335e69', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3'],
  'rose-pine': ['#26233a', '#eb6f92', '#31748f', '#f6c177', '#9ccfd8', '#c4a7e7', '#ebbcba', '#e0def4', '#6e6a86', '#eb6f92', '#31748f', '#f6c177', '#9ccfd8', '#c4a7e7', '#ebbcba', '#e0def4'],
  kanagawa: ['#090618', '#c34043', '#76946a', '#c0a36e', '#7e9cd8', '#957fb8', '#6a9589', '#c8c093', '#727169', '#e82424', '#98bb6c', '#e6c384', '#7fb4ca', '#938aa9', '#7aa89f', '#dcd7ba'],
  'everforest-dark': ['#7a8478', '#e67e80', '#a7c080', '#dbbc7f', '#7fbbb3', '#d699b6', '#83c092', '#f2efdf', '#a6b0a0', '#f85552', '#8da101', '#dfa000', '#3a94c5', '#df69ba', '#35a77c', '#fffbef'],
  'catppuccin-latte': ['#bcc0cc', '#d20f39', '#40a02b', '#df8e1d', '#1e66f5', '#ea76cb', '#179299', '#5c5f77', '#acb0be', '#e7103f', '#46b02f', '#e49931', '#3878f6', '#ef95d7', '#19a1a8', '#6c6f85'],
  'gruvbox-light': ['#fbf1c7', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#7c6f64', '#928374', '#9d0006', '#79740e', '#b57614', '#076678', '#8f3f71', '#427b58', '#3c3836'],
  'solarized-light': ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#bbb5a2', '#002b36', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3'],
  'rose-pine-dawn': ['#f2e9e1', '#b4637a', '#286983', '#ea9d34', '#56949f', '#907aa9', '#d7827e', '#575279', '#9893a5', '#b4637a', '#286983', '#ea9d34', '#56949f', '#907aa9', '#d7827e', '#575279'],
  'tokyo-night-day': ['#e9e9ed', '#f52a65', '#587539', '#8c6c3e', '#2e7de9', '#9854f1', '#007197', '#6172b0', '#a1a6c5', '#f52a65', '#587539', '#8c6c3e', '#2e7de9', '#9854f1', '#007197', '#3760bf'],
  'one-light': ['#000000', '#de3e35', '#3f953a', '#d2b67c', '#2f5af3', '#950095', '#3f953a', '#bbbbbb', '#000000', '#de3e35', '#3f953a', '#d2b67c', '#2f5af3', '#a00095', '#3f953a', '#ffffff'],
  'everforest-light': ['#7a8478', '#e67e80', '#9ab373', '#c1a266', '#7fbbb3', '#d699b6', '#83c092', '#b2af9f', '#a6b0a0', '#f85552', '#8da101', '#dfa000', '#3a94c5', '#df69ba', '#35a77c', '#fffbef'],
  'github-light': ['#24292f', '#cf222e', '#116329', '#4d2d00', '#0969da', '#8250df', '#1b7c83', '#6e7781', '#57606a', '#a40e26', '#1a7f37', '#633c01', '#218bff', '#a475f9', '#3192aa', '#8c959f'],
};

export const terminalPaletteNames: Readonly<Record<string, string>> = {
  dracula: 'Dracula', nord: 'Nord', 'gruvbox-dark': 'Gruvbox Dark',
  'catppuccin-mocha': 'Catppuccin Mocha', 'catppuccin-macchiato': 'Catppuccin Macchiato', 'catppuccin-frappe': 'Catppuccin Frappe',
  'tokyo-night': 'TokyoNight', 'one-dark': 'Atom One Dark', 'solarized-dark': 'iTerm2 Solarized Dark',
  'rose-pine': 'Rose Pine', kanagawa: 'Kanagawa Wave', 'everforest-dark': 'Everforest Dark Med',
  'catppuccin-latte': 'Catppuccin Latte', 'gruvbox-light': 'Gruvbox Light', 'solarized-light': 'iTerm2 Solarized Light',
  'rose-pine-dawn': 'Rose Pine Dawn', 'tokyo-night-day': 'TokyoNight Day', 'one-light': 'Atom One Light',
  'everforest-light': 'Everforest Light Med', 'github-light': 'GitHub Light Default',
};
