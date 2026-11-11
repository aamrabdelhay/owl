import React from 'react';

/**
 * Stroke icon set for OWL OS. Single source of truth for app + UI glyphs.
 * Kept as paths so icons inherit currentColor and stay crisp at 9–34 px.
 */
const P: Record<string, string> = {
  phone: 'M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A17 17 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z',
  message: 'M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 5Z M7 9h10 M7 12.5h6',
  chat: 'M4 4h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 15h-7l-4.5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 4Z M8 8.5h.01 M12 8.5h.01 M16 8.5h.01',
  contacts: 'M6 3h12a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 6 3Z M12 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8 17c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5',
  mail: 'M3.5 5.5h17v13h-17z M3.5 6l8.5 7 8.5-7',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3.2 9.5h17.6 M3.2 14.5h17.6 M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9Z',
  music: 'M9 18V5.5l10-2v12.5 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  video: 'M3.5 6.5h12v11h-12z M15.5 11l5-3.2v8.4l-5-3.2',
  image: 'M3.5 5.5h17v13h-17z M8.5 11a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z M4 17l5.2-5 3.3 3 2.5-2.2 4.6 4.2',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21 M8.5 21h7',
  bell: 'M12 3a6 6 0 0 0-6 6v4l-2 4h16l-2-4V9a6 6 0 0 0-6-6Z M10 20a2 2 0 0 0 4 0',
  radio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M7 4l-2 3 M17 4l2 3',
  camera: 'M3.5 8.5h4l1.5-2.5h6L16.5 8.5h4v11h-17z M12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
  flash: 'M13 2 5 13.5h5.5L9 22l9-12h-5.5z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.5 8.5l-2 5-5 2 2-5z',
  calendar: 'M4 6.5h16v14H4z M8 3.5v4 M16 3.5v4 M4 10.5h16 M8 14h2 M12 14h2 M16 14h1 M8 17.5h2 M12 17.5h2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5.5l4 2.5',
  calc: 'M5.5 3.5h13v17h-13z M8.5 7.5h7 M8.5 12h1.5 M13 12h1.5 M8.5 16h1.5 M13 16h1.5',
  swap: 'M4 8h13l-3-3 M20 16H7l3 3',
  memo: 'M6 3.5h9l3.5 3.5v13.5H6z M9 9h6 M9 12.5h6 M9 16h4',
  task: 'M4.5 6.5l2 2 3-3.5 M4.5 13l2 2 3-3.5 M4.5 19.5l2 2 3-3.5 M12 7h8 M12 13.5h8 M12 20h8',
  lock: 'M7 10.5h10a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19v-7A1.5 1.5 0 0 1 7 10.5Z M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5 M12 15v2.5',
  folder: 'M3.5 6h6l2 2.5h9V19h-17z',
  game: 'M8 8h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 8Z M8 12v3 M6.5 13.5h3 M15.5 12.5h.01 M17.5 15h.01',
  palette: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.4-2-.7-1.2.3-2.5 1.7-2.5H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z M7.5 10.5h.01 M10 7h.01 M14.5 7.5h.01 M17 10.5h.01',
  volume: 'M4 9.5h3l4-3.5v12l-4-3.5H4z M15 9a4.5 4.5 0 0 1 0 6 M17.8 6.5a8 8 0 0 1 0 11',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 0 1 0-2l-1.6-1.2 1.8-3.1 1.9.7a7 7 0 0 1 1.7-1l.3-2h3.6l.3 2a7 7 0 0 1 1.7 1l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 2Z',
  wand: 'M4 20 15 9 M13 4l1.2 2.8L17 8l-2.8 1.2L13 12l-1.2-2.8L9 8l2.8-1.2z M19 3.5v3 M17.5 5h3 M18 14v2.5 M16.8 15.2h2.5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M9.5 9.5a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.1 1-1.1 1.9v.4 M12 17.2h.01',
  snake: 'M4 17h9a5 5 0 0 0 0-10H9a3 3 0 0 0 0 6h6 M17 15.5h.01',
  block: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  skyowl: 'M3 15c3-1 5-3 7-6l2-3 2 3c2 3 4 5 7 6 M8 14l-2 5 M16 14l2 5 M11 12l-2-3 M13 12l2-3',
  cards: 'M3.5 8.5h9v11h-9z M8 8.5V5.5h9v11h-3 M6 13h4',
  mancala: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5v9 M9 10.5h.01 M15 10.5h.01 M9 13.5h.01 M15 13.5h.01',
  sudoku: 'M4 4h16v16H4z M9.3 4v16 M14.7 4v16 M4 9.3h16 M4 14.7h16',
  tetris: 'M4 15h5v5H4z M9 15h5v5H9z M14 10h5v5h-5z M9 10h5v5H9z M14 5h5v5h-5z',
  word: 'M5 19 11.5 5l6.5 14 M7.5 14h8',
  solitaire: 'M8 4.5h8l2 3v12H6v-12z M9 4.5V3h6v1.5 M9.5 12.5l2 2 3.5-3.5',
  media: 'M4 6.5h7v11H4z M13 5l7 4v6l-7 4z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v6 M12 7.5h.01',
  power: 'M12 3v8 M7 6.2a7.5 7.5 0 1 0 10 0',
  battery: 'M3 8h15v8H3z M18.5 10.5v3 M6 10.5v3 M9 10.5v3',
  wifi: 'M3 9a13 13 0 0 1 18 0 M6 12.5a9 9 0 0 1 12 0 M9 16a4.5 4.5 0 0 1 6 0 M12 19.5h.01',
  bluetooth: 'M8 8l8 8-4 3V5l4 3-8 8',
  signal: 'M4 20v-3 M9 20v-6 M14 20v-10 M19 20V6',
  back: 'M15 5 8 12l7 7',
  enter: 'M20 6v6H6 M10 8l-4 4 4 4',
  check: 'M5 13l4 4L19 7',
  star: 'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M4.5 7h15 M9 7V4.5h6V7 M6.5 7l1 13h9l1-13 M10 11v5 M14 11v5',
  download: 'M12 4v10 M8 10.5l4 4 4-4 M4.5 19.5h15',
  play: 'M7 4.5l12 7.5-12 7.5z',
  pause: 'M8 5h3v14H8z M14 5h3v14h-3z',
  next: 'M6 5l9 7-9 7z M18 5v14',
  prev: 'M18 5l-9 7 9 7z M6 5v14',
  shuffle: 'M4 7h4l9 10h3 M4 17h4l9-10h3 M17 4l3 3-3 3 M17 14l3 3-3 3',
  repeat: 'M4 9V7a2 2 0 0 1 2-2h11 M17 2.5 20.5 5 17 7.5 M20 15v2a2 2 0 0 1-2 2H6 M7 21.5 3.5 19 7 16.5',
  send: 'M3.5 12 21 3.5 14 21l-3.5-7.5z M10.5 13.5 21 3.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M16.5 16.5 21 21',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18 M10 5.8A8.4 8.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4 M6.5 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  cameraFlip: 'M4 8.5h3l1.5-2.5h7L17 8.5h3v11H4z M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M17 4.5l2 2',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  list: 'M4 6.5h16 M4 12h16 M4 17.5h16',
  arrowLeft: 'M15 5 8 12l7 7',
  arrowRight: 'M9 5l7 7-7 7',
  arrowUp: 'M5 15 12 8l7 7',
  arrowDown: 'M5 9l7 7 7-7',
  close: 'M6 6l12 12 M18 6 6 18',
  chevron: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0z M7 5H4v2a3 3 0 0 0 3 3 M17 5h3v2a3 3 0 0 1-3 3 M10 17h4 M9 21h6 M12 13v4',
  flag: 'M6 3v18 M6 4h11l-2 4 2 4H6',
  undo: 'M4 9h10a5 5 0 0 1 0 10H8 M4 9l4-4 M4 9l4 4',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5 5l1.4 1.4 M17.6 17.6 19 19 M19 5l-1.4 1.4 M6.4 17.6 5 19',
  wifiOff: 'M3 3l18 18 M3 9a13 13 0 0 1 6-3.3 M12 19.5h.01 M9 16a4.5 4.5 0 0 1 4-1.4',
  key: 'M8 15.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M11.5 11.5 21 11.5 M17 11.5v3 M20 11.5v2',
  shield: 'M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6z',
  batteryCharge: 'M3 8h15v8H3z M18.5 10.5v3 M6 10v4 M9 10v4 M12 10v4 M15 10v4',
  phoneOff: 'M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A17 17 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z M3 21 21 3',
  headphones: 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v6H6a2 2 0 0 1-2-2z M20 14h-3v6h1a2 2 0 0 0 2-2z',
  compassRose: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 3v3 M12 18v3 M3 12h3 M18 12h3',
};

export type IconName = keyof typeof P | string;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.7,
  className,
  style,
  fill = false,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  fill?: boolean;
}) {
  const path = P[name] || P.info;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path}
        fill={fill ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Icon;
