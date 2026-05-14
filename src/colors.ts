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
  {
    name: 'ocean',
    colors: ['#005f73', '#0a9396', '#94d2bd', '#e9d8a6', '#ee9b00', '#ca6702', '#bb3e03'],
    bgColor: '#001219',
    outlineColor: '#000a10',
    leftDarken: 0.72,
    rightDarken: 0.55,
  },
  {
    name: 'sunset',
    colors: ['#3a0ca3', '#7209b7', '#b5179e', '#f72585', '#ff8500', '#ffaa00', '#ffd60a'],
    bgColor: '#0d0221',
    outlineColor: '#020010',
    leftDarken: 0.68,
    rightDarken: 0.48,
  },
  {
    name: 'vaporwave',
    colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96', '#f72585', '#3a0ca3'],
    bgColor: '#2e1a47',
    outlineColor: '#0d0223',
    leftDarken: 0.65,
    rightDarken: 0.45,
  },
  {
    name: "we're all trying to find the guy who did this",
    colors: ['#582f0e', '#7f4f24', '#936639', '#a44a3f', '#bc4749', '#e09f3e', '#a4161a'],
    bgColor: '#1a0e0a',
    outlineColor: '#0d0705',
    leftDarken: 0.74,
    rightDarken: 0.56,
  },
  {
    name: 'nordic',
    colors: ['#5e81ac', '#81a1c1', '#88c0d0', '#8fbcbb', '#a3be8c', '#d08770', '#bf616a'],
    bgColor: '#2e3440',
    outlineColor: '#1a1d24',
    leftDarken: 0.74,
    rightDarken: 0.55,
  },
  {
    name: 'cyberpunk',
    colors: ['#ff2a6d', '#05d9e8', '#d1f7ff', '#7700ff', '#ffd60a', '#ff2057', '#9d4edd'],
    bgColor: '#01012b',
    outlineColor: '#000000',
    leftDarken: 0.65,
    rightDarken: 0.45,
  },
  {
    name: 'mocha',
    colors: ['#3e2723', '#6f4e37', '#a47148', '#c08552', '#dab785', '#f2e8cf', '#bc6c25'],
    bgColor: '#1a0e08',
    outlineColor: '#0a0500',
    leftDarken: 0.76,
    rightDarken: 0.58,
  },
  {
    name: 'savanna',
    colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#bc4749', '#6a040f'],
    bgColor: '#f4e9d8',
    outlineColor: '#0a1418',
    leftDarken: 0.76,
    rightDarken: 0.58,
  },
  {
    name: 'candy',
    colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06ffa5', '#ff5d8f'],
    bgColor: '#fff0f5',
    outlineColor: '#2a0a40',
    leftDarken: 0.74,
    rightDarken: 0.55,
  },
  {
    name: 'ramp light',
    colors: ['#1A1919', '#474543', '#6E6A68', '#E4F222', '#f5ff78', '#D2CECB', '#FCFBFA'],
    bgColor: '#FCFBFA',
    outlineColor: '#1A1919',
    leftDarken: 0.82,
    rightDarken: 0.65,
  },
  {
    name: 'ramp dark',
    colors: ['#FCFBFA', '#D2CECB', '#A39D99', '#E4F222', '#f5ff78', '#474543', '#1A1919'],
    bgColor: '#1A1919',
    outlineColor: '#0A0A0A',
    leftDarken: 0.78,
    rightDarken: 0.60,
  },
];

export function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}
