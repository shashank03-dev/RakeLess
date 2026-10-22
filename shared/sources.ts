export type Source = {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  appliesTo: string;
  summary: string;
};

/** Short paraphrases written for this app. Not endorsements or expert review of RakeLess. */
export const SOURCES: Record<string, Source> = {
  habitat: {
    id: 'habitat',
    title: 'Leave the Leaves to Attract Birds',
    publisher: 'National Wildlife Federation',
    date: '2026-09-25',
    url: 'https://blog.nwf.org/2026/09/leave-the-leaves-to-attract-birds/',
    appliesTo: 'Leaf cover in garden beds and under trees',
    summary:
      'A leaf layer is foraging ground for birds, and leaves left unraked or piled at the garden edge supply nesting material. It does not address paths, lawns, or diseased plants.',
  },
  cleanup: {
    id: 'cleanup',
    title: 'Fall Garden Tasks',
    publisher: 'Penn State Extension',
    date: '2026-09-09',
    url: 'https://extension.psu.edu/fall-garden-tasks',
    appliesTo: 'Leaves in beds, diseased material, and heavy layers on lawns',
    summary:
      'In garden beds, leaves can stay where they fall to insulate roots. Diseased stems and leaves are the exception: destroy them rather than compost them. On lawns you do not need to rake, but a heavy layer can smother grass.',
  },
  turf: {
    id: 'turf',
    title: 'Fall leaf mulching is good for your lawn',
    publisher: 'University of Minnesota Extension',
    date: '2024-10-16',
    url: 'https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/fall-leaf-mulching-is-good-for-your-lawn',
    appliesTo: 'Leaves on lawns',
    summary:
      'A light layer of leaves can be mulched into turf, but a thick mat can smother grass. A photo cannot tell which one you have.',
  },
  cues: {
    id: 'cues',
    title: 'Messy Ecosystems, Orderly Frames',
    publisher: 'Joan Nassauer, research listing',
    date: '1995 (review 2020)',
    url: 'https://www.joan-nassauer.com/theory',
    appliesTo: 'Why visible boundaries and signs matter',
    summary:
      'People read ecological “mess” as neglect unless there are visible cues of care, such as a clean edge, a kept path, or a sign.',
  },
};
