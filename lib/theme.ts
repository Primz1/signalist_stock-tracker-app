/**
 * Hex mirrors of the CSS tokens in app/globals.css, for things that can't read
 * CSS variables: lightweight-charts canvases, TradingView iframes, SVG attributes.
 * Keep in sync with the --sg-* OKLCH values.
 */
export const PALETTE = {
  canvas: '#0D0C0A',
  surface: '#151311',
  surface2: '#1E1B18',
  surface3: '#262420',
  line: '#282623',
  lineStrong: '#3B3733',
  ink: '#F5F3EF',
  ink2: '#BDBAB5',
  ink3: '#8C8983',
  signal: '#FCD55F',
  signalInk: '#1F1A10',
  up: '#47CF79',
  down: '#F75D59',
  warm: '#E7853A',
} as const;

/** Muted ladder for allocation charts — amber first, then warm neutrals. */
export const SERIES = ['#FCD55F', '#E7853A', '#B9A27A', '#8C8983', '#6F6A62', '#4E4A44', '#C9B98F'];
