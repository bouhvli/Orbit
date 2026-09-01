import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (props: P) => ({
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const IconToday = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 6v4.2l2.6 1.6" />
  </svg>
)

export const IconProjects = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6.2 10 3l7 3.2-7 3.2z" />
    <path d="M3 10.4 10 13.6l7-3.2M3 14.2 10 17.4l7-3.2" />
  </svg>
)

export const IconTasks = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 5.6 4.6 7.2 7.6 4" />
    <path d="M3 13.6 4.6 15.2 7.6 12" />
    <path d="M10 5.8h7M10 13.8h7" />
  </svg>
)

export const IconMeetings = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="14" height="12.5" rx="2.2" />
    <path d="M3 8.2h14M7 3v3M13 3v3" />
  </svg>
)

export const IconNotes = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 3h6.5L16 7.4V17H5z" />
    <path d="M11.2 3v4.4H16M7.6 11h5M7.6 13.8h3.4" />
  </svg>
)

export const IconFocus = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="3.2" />
    <path d="M10 1.6v2M10 16.4v2M1.6 10h2M16.4 10h2" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h9M15.5 6H17M3 14h2.5M8.5 14H17M3 10h5M11 10h6" />
    <circle cx="13.6" cy="6" r="1.7" />
    <circle cx="6.9" cy="14" r="1.7" />
    <circle cx="9.6" cy="10" r="1.7" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8.8" cy="8.8" r="5.3" />
    <path d="m12.8 12.8 3.7 3.7" />
  </svg>
)

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
)

export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m7.5 4.5 5 5.5-5 5.5" />
  </svg>
)

export const IconArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 10h11M11 6l4 4-4 4" />
  </svg>
)

export const IconArchive = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="14" height="3.6" rx="1.2" />
    <path d="M4.4 7.6V15a1.5 1.5 0 0 0 1.5 1.5h8.2a1.5 1.5 0 0 0 1.5-1.5V7.6M8.2 11h3.6" />
  </svg>
)

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 10h6.6L14 6M8.6 9v4M11.4 9v4" />
  </svg>
)

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4.3l2.8 1.7" />
  </svg>
)

export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.4 11.6a3 3 0 0 0 4.3 0l2.3-2.4a3 3 0 0 0-4.3-4.2l-1 1" />
    <path d="M11.6 8.4a3 3 0 0 0-4.3 0L5 10.8a3 3 0 0 0 4.3 4.2l1-1" />
  </svg>
)

export const IconFlag = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 17V3.6M5 4.2h9.2l-2 3.2 2 3.2H5" />
  </svg>
)

export const IconSpark = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 2.6 11.8 8 17.4 10 11.8 12 10 17.4 8.2 12 2.6 10 8.2 8z" />
  </svg>
)

export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15.6 12.4A6.6 6.6 0 0 1 7.6 4.4a6.8 6.8 0 1 0 8 8z" />
  </svg>
)

export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="3.6" />
    <path d="M10 2.4v1.6M10 16v1.6M2.4 10h1.6M16 10h1.6M4.6 4.6l1.1 1.1M14.3 14.3l1.1 1.1M15.4 4.6l-1.1 1.1M5.7 14.3l-1.1 1.1" />
  </svg>
)

export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
  </svg>
)

export const IconPlay = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 4.6 15 10l-8.5 5.4z" />
  </svg>
)

export const IconPause = (p: P) => (
  <svg {...base(p)}>
    <path d="M7.4 4.8v10.4M12.6 4.8v10.4" />
  </svg>
)

export const IconStop = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="5.5" width="9" height="9" rx="1.6" />
  </svg>
)

export const IconCheckCircle = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7" />
    <path d="m6.8 10.2 2.2 2.2 4.2-4.6" />
  </svg>
)

export const IconInbox = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11.5 5.2 4.4h9.6L17 11.5V15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15z" />
    <path d="M3 11.5h3.6l1 2h4.8l1-2H17" />
  </svg>
)

export const IconOrbit = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="3" />
    <ellipse cx="10" cy="10" rx="8" ry="4" transform="rotate(-28 10 10)" />
  </svg>
)
