export interface Palette {
  name: string;
  colors: string[];
  bgColor: string;
  outlineColor: string;
  leftDarken: number;
  rightDarken: number;
}

export const PALETTES: Palette[] = [
  {
    name: 'retro',
    colors: ['#F5C842', '#7FB8D4', '#E8897A', '#5BBFB2', '#9BAFD4', '#E87948', '#B89FC8'],
    bgColor: '#2e2e2e',
    outlineColor: '#1a1826',
    leftDarken: 0.78,
    rightDarken: 0.60,
  },
  {
    name: 'neon',
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f1c', '#2ec4b6'],
    bgColor: '#08080f',
    outlineColor: '#000000',
    leftDarken: 0.70,
    rightDarken: 0.50,
  },
  {
    name: 'pastel',
    colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff'],
    bgColor: '#f0ece8',
    outlineColor: '#a09890',
    leftDarken: 0.82,
    rightDarken: 0.68,
  },
  {
    name: 'forest',
    colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc'],
    bgColor: '#081c15',
    outlineColor: '#040e0a',
    leftDarken: 0.70,
    rightDarken: 0.52,
  },
  {
    name: 'mono',
    colors: ['#f0f0f0', '#d4d4d4', '#b8b8b8', '#9c9c9c', '#808080', '#646464', '#484848'],
    bgColor: '#1a1a1a',
    outlineColor: '#0a0a0a',
    leftDarken: 0.75,
    rightDarken: 0.58,
  },
];

export function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}
