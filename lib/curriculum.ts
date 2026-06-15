import type { Section } from '@/lib/schedule';

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
