import type { Section } from '@/lib/schedule';

// ---- The Complete JavaScript Course (Jonas Schmedtmann) — course `js`, COMPLETED ----

// videoMinutes are estimates scaled to the published ~71h total; editable seed data.
export const CURRICULUM: Section[] = [
  { id: 1,  title: 'Welcome, Welcome, Welcome!',                          videoMinutes: 24,  kind: 'core',  sortOrder: 1 },
  { id: 2,  title: 'JavaScript Fundamentals – Part 1',                    videoMinutes: 300, kind: 'core',  sortOrder: 2 },
  { id: 3,  title: 'JavaScript Fundamentals – Part 2',                    videoMinutes: 270, kind: 'core',  sortOrder: 3 },
  { id: 4,  title: 'How to Navigate This Course',                         videoMinutes: 12,  kind: 'bonus', sortOrder: 4 },
  { id: 5,  title: 'Developer Skills & Editor Setup',                     videoMinutes: 108, kind: 'core',  sortOrder: 5 },
  { id: 6,  title: '[OPTIONAL] HTML & CSS Crash Course',                  videoMinutes: 90,  kind: 'skip',  sortOrder: 6 },
  { id: 7,  title: 'JS in the Browser: DOM & Events [PROJECT]',           videoMinutes: 300, kind: 'core',  sortOrder: 7 },
  { id: 8,  title: 'How JavaScript Works Behind the Scenes',              videoMinutes: 180, kind: 'core',  sortOrder: 8 },
  { id: 9,  title: 'Data Structures, Modern Operators & Strings',         videoMinutes: 270, kind: 'core',  sortOrder: 9 },
  { id: 10, title: 'A Closer Look at Functions',                          videoMinutes: 210, kind: 'core',  sortOrder: 10 },
  { id: 11, title: 'Working With Arrays — Bankist [PROJECT]',             videoMinutes: 360, kind: 'core',  sortOrder: 11 },
  { id: 12, title: 'Numbers, Dates, Intl & Timers [PROJECT]',            videoMinutes: 180, kind: 'core',  sortOrder: 12 },
  { id: 13, title: 'Advanced DOM and Events [PROJECT]',                   videoMinutes: 270, kind: 'core',  sortOrder: 13 },
  { id: 14, title: 'Object-Oriented Programming (OOP)',                   videoMinutes: 330, kind: 'core',  sortOrder: 14 },
  { id: 15, title: 'Mapty App: OOP, Geolocation, Libraries [PROJECT]',    videoMinutes: 270, kind: 'core',  sortOrder: 15 },
  { id: 16, title: 'Asynchronous JS: Promises, Async/Await, AJAX',        videoMinutes: 330, kind: 'core',  sortOrder: 16 },
  { id: 17, title: 'Modern JS Development: Modules, Tooling, Functional', videoMinutes: 270, kind: 'core',  sortOrder: 17 },
  { id: 18, title: 'Forkify App: Building a Modern Application [PROJECT]', videoMinutes: 420, kind: 'core',  sortOrder: 18 },
  { id: 19, title: 'Setting Up Git and Deployment',                       videoMinutes: 48,  kind: 'bonus', sortOrder: 19 },
  { id: 20, title: 'The End!',                                            videoMinutes: 12,  kind: 'bonus', sortOrder: 20 },
  { id: 21, title: '[LEGACY] Access the Old Course',                      videoMinutes: 24,  kind: 'bonus', sortOrder: 21 },
];

// ---- The Ultimate React Course (Jonas Schmedtmann, 2023) — course `react-2023`, ACTIVE ----
// Section id = 100 + the course folder number, so React ids (101..131) never collide
// with the JS ids (1..21) in the shared `sections` table, and the Course Player's
// `sectionNumber` maps to an id with one addition. sortOrder = the folder number.
// The Course Player relies on this mapping (course-player/shared/types.ts JourneySession):
// renumbering here orphans every player session already stored.
export const REACT_SECTION_ID_OFFSET = 100;

// [folder number, folder title without "NN ", exact video seconds] — from
// course-player/docs/react-2023-section-durations.json (mp4 header durations, 2026-10-01).
// "(Optional)" stays in the title as information only: every section counts toward
// the plan except §04 (JS review — she just finished the JS course). Rahul's call.
const REACT_SECTIONS: ReadonlyArray<readonly [number, string, number]> = [
  [1, 'Welcome, Welcome, Welcome!', 1849.588],
  [2, 'Part 1 - React Fundamentals (4 Projects)', 55.589],
  [3, 'A First Look at React', 4496.186],
  [4, 'Review of Essential JavaScript for React (Optional)', 6748.2],
  [5, 'Working With Components, Props, and JSX', 10453.457],
  [6, 'State, Events, and Forms - Interactive Components', 10503.78],
  [7, 'Thinking In React - State Management', 9722.575],
  [8, 'Practice Project - Eat-\'N-Split (Optional)', 5352.364],
  [9, 'Part 2 - Intermediate React (2 Projects)', 75.814],
  [10, 'Thinking in React - Components, Composition, and Reusability', 9524.351],
  [11, 'How React Works Behind the Scenes', 9497.671],
  [12, 'Effects and Data Fetching', 11586.252],
  [13, 'Custom Hooks, Refs, and More State', 7301.703],
  [14, 'React Before Hooks - Class-Based React (Optional)', 4948.412],
  [15, 'Part 3 - Advanced React + Redux (4 Projects)', 71.216],
  [16, 'The Advanced useReducer Hook', 11688.352],
  [17, 'React Router - Building Single-Page Applications (SPA)', 10773.089],
  [18, 'Advanced State Management - The Context API', 14822.762],
  [19, 'Performance Optimization and Advanced useEffect', 10625.02],
  [20, 'Redux and Modern Redux Toolkit (With Thunks)', 10640.767],
  [21, 'Part 4 - Professional React Development (2 Projects)', 87.8],
  [22, 'React Router With Data Loading (v6.4+)', 7624.829],
  [23, 'Tailwind CSS Crash Course - Styling the App (Optional)', 11719.887],
  [24, 'Adding Redux and Advanced React Router', 9871.139],
  [25, 'Setting Up Our Biggest Project + Styled Components', 6600.154],
  [26, 'Supabase Crash Course - Building a Back-End!', 3116.461],
  [27, 'React Query - Managing Remote State', 11895.529],
  [28, 'Advanced React Patterns', 9621.861],
  [29, 'Implementing More Features - Authentication, Dark Mode, Dashboard, etc. (Optional)', 28266.638],
  [30, 'Deployment With Netlify and Vercel', 2080.789],
  [31, 'The End!', 200.737],
];

export const REACT_CURRICULUM: Section[] = REACT_SECTIONS.map(([n, title, seconds]) => ({
  id: REACT_SECTION_ID_OFFSET + n,
  title,
  videoMinutes: Math.round(seconds / 60),
  kind: n === 4 ? 'skip' : 'core',
  sortOrder: n,
}));
