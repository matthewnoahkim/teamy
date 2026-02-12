// 2026 Science Olympiad Event Categories
// Source: https://soinc.org/events/2026-event-table

export type EventCategory =
  | 'Life, Personal & Social Science'
  | 'Earth and Space Science'
  | 'Physical Science & Chemistry'
  | 'Technology & Engineering'
  | 'Inquiry & Nature of Science'

interface EventCategoryMap {
  [slug: string]: EventCategory
}

// Division B Event Categories (2026)
export const divisionBCategories: EventCategoryMap = {
  // Life, Personal & Social Science
  'anatomy-physiology-b': 'Life, Personal & Social Science',
  'disease-detectives-b': 'Life, Personal & Social Science',
  'entomology-b': 'Life, Personal & Social Science',
  'heredity-b': 'Life, Personal & Social Science',
  'water-quality-b': 'Life, Personal & Social Science',

  // Earth and Space Science
  'dynamic-planet-b': 'Earth and Space Science',
  'meteorology-b': 'Earth and Space Science',
  'remote-sensing-b': 'Earth and Space Science',
  'rocks-minerals-b': 'Earth and Space Science',
  'solar-system-b': 'Earth and Space Science',

  // Physical Science & Chemistry
  'circuit-lab-b': 'Physical Science & Chemistry',
  'crime-busters-b': 'Physical Science & Chemistry',
  'hovercraft-b': 'Physical Science & Chemistry',
  'machines-b': 'Physical Science & Chemistry',
  'potions-poisons-b': 'Physical Science & Chemistry',

  // Technology & Engineering
  'boomilever-b': 'Technology & Engineering',
  'helicopter-b': 'Technology & Engineering',
  'mission-possible-b': 'Technology & Engineering',
  'scrambler-b': 'Technology & Engineering',

  // Inquiry & Nature of Science
  'codebusters-b': 'Inquiry & Nature of Science',
  'experimental-design-b': 'Inquiry & Nature of Science',
  'metric-mastery-b': 'Inquiry & Nature of Science',
  'write-it-do-it-b': 'Inquiry & Nature of Science',
}

// Division C Event Categories (2026)
export const divisionCCategories: EventCategoryMap = {
  // Life, Personal & Social Science
  'anatomy-physiology-c': 'Life, Personal & Social Science',
  'designer-genes-c': 'Life, Personal & Social Science',
  'disease-detectives-c': 'Life, Personal & Social Science',
  'entomology-c': 'Life, Personal & Social Science',
  'water-quality-c': 'Life, Personal & Social Science',

  // Earth and Space Science
  'astronomy-c': 'Earth and Space Science',
  'dynamic-planet-c': 'Earth and Space Science',
  'remote-sensing-c': 'Earth and Space Science',
  'rocks-minerals-c': 'Earth and Space Science',

  // Physical Science & Chemistry
  'chemistry-lab-c': 'Physical Science & Chemistry',
  'circuit-lab-c': 'Physical Science & Chemistry',
  'forensics-c': 'Physical Science & Chemistry',
  'hovercraft-c': 'Physical Science & Chemistry',
  'machines-c': 'Physical Science & Chemistry',
  'materials-science-c': 'Physical Science & Chemistry',

  // Technology & Engineering
  'boomilever-c': 'Technology & Engineering',
  'electric-vehicle-c': 'Technology & Engineering',
  'helicopter-c': 'Technology & Engineering',
  'robot-tour-c': 'Technology & Engineering',

  // Inquiry & Nature of Science
  'bungee-drop-c': 'Inquiry & Nature of Science',
  'codebusters-c': 'Inquiry & Nature of Science',
  'engineering-cad-c': 'Inquiry & Nature of Science',
  'experimental-design-c': 'Inquiry & Nature of Science',
}

export function getEventCategory(slug: string, division: 'B' | 'C'): EventCategory | null {
  const categories = division === 'B' ? divisionBCategories : divisionCCategories
  return categories[slug] || null
}

export function groupEventsByCategory<T extends { slug: string }>(events: T[], division: 'B' | 'C') {
  const categories = division === 'B' ? divisionBCategories : divisionCCategories
  
  const grouped: Record<EventCategory, T[]> = {
    'Life, Personal & Social Science': [],
    'Earth and Space Science': [],
    'Physical Science & Chemistry': [],
    'Technology & Engineering': [],
    'Inquiry & Nature of Science': [],
  }

  events.forEach(event => {
    const category = categories[event.slug]
    if (category) {
      grouped[category].push(event)
    }
  })

  return grouped
}

// Order for displaying categories
export const categoryOrder: EventCategory[] = [
  'Life, Personal & Social Science',
  'Earth and Space Science',
  'Physical Science & Chemistry',
  'Technology & Engineering',
  'Inquiry & Nature of Science',
]

