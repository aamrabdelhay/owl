export interface KeyEventLike {
  key: string;
  code: string;
  dispatch?: 'physical' | 'touch' | 'virtual';
  shift: boolean;
  caps: boolean;
  ctrl: boolean;
  alt: boolean;
  repeat?: boolean;
}

export type NavDir = 'up' | 'down' | 'left' | 'right';
