/** Minimal 1.5px-stroke icon set on a 20px grid. Decorative unless labelled. */
import type { SVGProps } from 'react';

const PATHS = {
  check: 'M4.5 10.5 8 14l7.5-8',
  x: 'm5.5 5.5 9 9m0-9-9 9',
  info: 'M10 9v5m0-8h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  alert: 'M10 7v4m0 3h.01M8.6 3.2 1.9 15a1.6 1.6 0 0 0 1.4 2.4h13.4a1.6 1.6 0 0 0 1.4-2.4L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z',
  clock: 'M10 5.5V10l3 2m5-2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  arrowRight: 'M4 10h12m-5-5 5 5-5 5',
  arrowLeft: 'M16 10H4m5-5-5 5 5 5',
  menu: 'M3 6h14M3 10h14M3 14h14',
  copy: 'M7 7V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5v7a1.5 1.5 0 0 1-1.5 1.5H13M4.5 7h7A1.5 1.5 0 0 1 13 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7Z',
  shield: 'M10 2.5 4 5v4.6c0 3.6 2.5 6.7 6 7.9 3.5-1.2 6-4.3 6-7.9V5l-6-2.5Z',
  lock: 'M6 9V6.5a4 4 0 1 1 8 0V9M5 9h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z',
  bank: 'M3 8h14M10 2.5 3 6v2h14V6l-7-3.5ZM5 8v6m3.3-6v6m3.4-6v6M15 8v6M3 17h14',
  card: 'M2.5 7.5h15M4 4.5h12A1.5 1.5 0 0 1 17.5 6v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 14V6A1.5 1.5 0 0 1 4 4.5Zm1.5 7h3',
  wire: 'M3 10h3l2-5 4 10 2-5h3',
  cash: 'M3 5.5h14v9H3zM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5.5 8v.01M14.5 12v.01',
  user: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.5c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5',
  refresh: 'M16 4v4h-4M4 16v-4h4m8.2-4A6.5 6.5 0 0 0 4.3 7.5m11.4 5A6.5 6.5 0 0 1 3.8 12',
  sun: 'M10 2v1.5m0 13V18m8-8h-1.5m-13 0H2m13.66-5.66-1.06 1.06M5.4 14.6l-1.06 1.06m11.32 0-1.06-1.06M5.4 5.4 4.34 4.34M13.5 10a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
  moon: 'M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z',
  arrowUpRight: 'M6 14 14 6M7.5 6H14v6.5',
  layers: 'M10 3 17 6.5 10 10 3 6.5ZM3 10l7 3.5 7-3.5M3 13.5l7 3.5 7-3.5',
  globe: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-8-8h16M10 2c2.2 2.2 3 5 3 8s-.8 5.8-3 8c-2.2-2.2-3-5-3-8s.8-5.8 3-8Z',
  play: 'M7.5 5.8v8.4l6.8-4.2Z',
  external: 'M11 3h6v6m0-6-8 8M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12',
  chat: 'M4.5 4h11A1.5 1.5 0 0 1 17 5.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3h-.5A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4Z',
  send: 'M3.5 10 17 3.5 13 17l-2.5-5.5L3.5 10Zm7 1.5L17 3.5',
  search: 'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.6-1.9L17.5 17.5',
  grid: 'M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z',
  inbox: 'M3 11.5 5 4.5h10l2 7m-14 0v4h14v-4m-14 0h4l1 2h4l1-2h4',
  list: 'M7 5.5h10M7 10h10M7 14.5h10M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01',
  users: 'M7.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 7c.5-2.6 2.5-4 5-4s4.5 1.4 5 4m1-12.8a3 3 0 0 1 0 5.6m1.5 3.4c1.5.5 2.3 1.8 2.5 3.8',
  file: 'M11.5 2.5H5.5A1.5 1.5 0 0 0 4 4v12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16V7l-4.5-4.5Zm0 0V7H16M7 11h6M7 14h4',
  flask: 'M8 2.5h4M8.7 2.5v5L4 15.5A1.4 1.4 0 0 0 5.2 17.5h9.6a1.4 1.4 0 0 0 1.2-2L11.3 7.5v-5M6.2 12.5h7.6',
  briefcase: 'M3 7h14v9.5H3zM7 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 5v2M3 11.5h14',
  activity: 'M2.5 10h3l2-5.5 5 11 2-5.5h3',
  logout: 'M8 17H4.5A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3H8m5 10.5L16.5 10 13 6.5M16.5 10H7.5',
  bell: 'M10 17.5a2 2 0 0 0 2-2H8a2 2 0 0 0 2 2Zm5-5.5V9a5 5 0 1 0-10 0v3l-1.5 2.5h13L15 12Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, title, ...rest }: { name: IconName; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
