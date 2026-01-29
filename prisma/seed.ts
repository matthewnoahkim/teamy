import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Division } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined

const prisma = new PrismaClient({
  ...(adapter ? { adapter } : {}),
})

// Division C Events (2026)
const divisionCEvents = [
  // Life, Personal & Social Science
  { name: 'Anatomy and Physiology', slug: 'anatomy-physiology-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Designer Genes', slug: 'designer-genes-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Disease Detectives', slug: 'disease-detectives-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Entomology', slug: 'entomology-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Water Quality', slug: 'water-quality-c', maxCompetitors: 2, selfScheduled: false },
  // Earth and Space Science
  { name: 'Astronomy', slug: 'astronomy-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Dynamic Planet', slug: 'dynamic-planet-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Remote Sensing', slug: 'remote-sensing-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Rocks and Minerals', slug: 'rocks-minerals-c', maxCompetitors: 2, selfScheduled: false },
  // Physical Science & Chemistry
  { name: 'Chemistry Lab', slug: 'chemistry-lab-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Circuit Lab', slug: 'circuit-lab-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Forensics', slug: 'forensics-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Hovercraft', slug: 'hovercraft-c', maxCompetitors: 2, selfScheduled: true },
  { name: 'Machines', slug: 'machines-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Materials Science', slug: 'materials-science-c', maxCompetitors: 2, selfScheduled: false },
  // Technology & Engineering
  { name: 'Boomilever', slug: 'boomilever-c', maxCompetitors: 2, selfScheduled: true },
  { name: 'Electric Vehicle', slug: 'electric-vehicle-c', maxCompetitors: 2, selfScheduled: true },
  { name: 'Helicopter', slug: 'helicopter-c', maxCompetitors: 2, selfScheduled: true },
  { name: 'Robot Tour', slug: 'robot-tour-c', maxCompetitors: 2, selfScheduled: true },
  // Inquiry & Nature of Science
  { name: 'Bungee Drop', slug: 'bungee-drop-c', maxCompetitors: 2, selfScheduled: true },
  { name: 'Codebusters', slug: 'codebusters-c', maxCompetitors: 3, selfScheduled: false },
  { name: 'Engineering CAD', slug: 'engineering-cad-c', maxCompetitors: 2, selfScheduled: false },
  { name: 'Experimental Design', slug: 'experimental-design-c', maxCompetitors: 3, selfScheduled: false },
]

// Division B Events (2026)
const divisionBEvents = [
  // Life, Personal & Social Science
  { name: 'Anatomy and Physiology', slug: 'anatomy-physiology-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Disease Detectives', slug: 'disease-detectives-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Entomology', slug: 'entomology-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Heredity', slug: 'heredity-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Water Quality', slug: 'water-quality-b', maxCompetitors: 2, selfScheduled: false },
  // Earth and Space Science
  { name: 'Dynamic Planet', slug: 'dynamic-planet-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Meteorology', slug: 'meteorology-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Remote Sensing', slug: 'remote-sensing-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Rocks and Minerals', slug: 'rocks-minerals-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Solar System', slug: 'solar-system-b', maxCompetitors: 2, selfScheduled: false },
  // Physical Science & Chemistry
  { name: 'Circuit Lab', slug: 'circuit-lab-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Crime Busters', slug: 'crime-busters-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Hovercraft', slug: 'hovercraft-b', maxCompetitors: 2, selfScheduled: true },
  { name: 'Machines', slug: 'machines-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Potions and Poisons', slug: 'potions-poisons-b', maxCompetitors: 2, selfScheduled: false },
  // Technology & Engineering
  { name: 'Boomilever', slug: 'boomilever-b', maxCompetitors: 2, selfScheduled: true },
  { name: 'Helicopter', slug: 'helicopter-b', maxCompetitors: 2, selfScheduled: true },
  { name: 'Mission Possible', slug: 'mission-possible-b', maxCompetitors: 2, selfScheduled: true },
  { name: 'Scrambler', slug: 'scrambler-b', maxCompetitors: 2, selfScheduled: true },
  // Inquiry & Nature of Science
  { name: 'Codebusters', slug: 'codebusters-b', maxCompetitors: 3, selfScheduled: false },
  { name: 'Experimental Design', slug: 'experimental-design-b', maxCompetitors: 3, selfScheduled: false },
  { name: 'Metric Mastery', slug: 'metric-mastery-b', maxCompetitors: 2, selfScheduled: false },
  { name: 'Write It Do It', slug: 'write-it-do-it-b', maxCompetitors: 2, selfScheduled: false },
]

// Division C Conflict Groups (2026)
const divisionCConflictGroups = [
  { blockNumber: 1, name: 'Group 1', events: ['anatomy-physiology-c', 'engineering-cad-c', 'forensics-c'] },
  { blockNumber: 2, name: 'Group 2', events: ['codebusters-c', 'disease-detectives-c', 'remote-sensing-c'] },
  { blockNumber: 3, name: 'Group 3', events: ['astronomy-c', 'entomology-c', 'experimental-design-c'] },
  { blockNumber: 4, name: 'Group 4', events: ['chemistry-lab-c', 'machines-c'] },
  { blockNumber: 5, name: 'Group 5', events: ['circuit-lab-c', 'dynamic-planet-c', 'water-quality-c'] },
  { blockNumber: 6, name: 'Group 6', events: ['designer-genes-c', 'materials-science-c', 'rocks-minerals-c'] },
]

// Division B Conflict Groups (2026)
const divisionBConflictGroups = [
  { blockNumber: 1, name: 'Group 1', events: ['codebusters-b', 'disease-detectives-b', 'remote-sensing-b'] },
  { blockNumber: 2, name: 'Group 2', events: ['entomology-b', 'experimental-design-b', 'solar-system-b'] },
  { blockNumber: 3, name: 'Group 3', events: ['machines-b', 'meteorology-b', 'metric-mastery-b'] },
  { blockNumber: 4, name: 'Group 4', events: ['circuit-lab-b', 'dynamic-planet-b', 'water-quality-b'] },
  { blockNumber: 5, name: 'Group 5', events: ['heredity-b', 'potions-poisons-b', 'rocks-minerals-b'] },
  { blockNumber: 6, name: 'Group 6', events: ['anatomy-physiology-b', 'crime-busters-b', 'write-it-do-it-b'] },
]

async function seed() {
  console.log('🌱 Starting seed...')

  // Clear existing data (in reverse order of dependencies)
  console.log('🗑️  Clearing existing data...')
  await prisma.conflictGroupEvent.deleteMany()
  await prisma.conflictGroup.deleteMany()
  await prisma.rosterAssignment.deleteMany()
  await prisma.event.deleteMany()
  await prisma.announcementVisibility.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.calendarEvent.deleteMany()
  await prisma.emailLog.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.team.deleteMany()
  await prisma.club.deleteMany()

  // Seed Division C Events
  console.log('📚 Seeding Division C events...')
  const createdCEvents = await Promise.all(
    divisionCEvents.map((event) =>
      prisma.event.create({
        data: {
          division: Division.C,
          name: event.name,
          slug: event.slug,
          maxCompetitors: event.maxCompetitors,
          selfScheduled: event.selfScheduled,
        },
      })
    )
  )
  console.log(`✅ Created ${createdCEvents.length} Division C events`)

  // Seed Division B Events
  console.log('📚 Seeding Division B events...')
  const createdBEvents = await Promise.all(
    divisionBEvents.map((event) =>
      prisma.event.create({
        data: {
          division: Division.B,
          name: event.name,
          slug: event.slug,
          maxCompetitors: event.maxCompetitors,
          selfScheduled: event.selfScheduled,
        },
      })
    )
  )
  console.log(`✅ Created ${createdBEvents.length} Division B events`)

  // Create a map of slug -> eventId for Division C
  const cEventMap = new Map(createdCEvents.map(e => [e.slug, e.id]))

  // Seed Division C Conflict Groups
  console.log('🔗 Seeding Division C conflict groups...')
  for (const group of divisionCConflictGroups) {
    const conflictGroup = await prisma.conflictGroup.create({
      data: {
        division: Division.C,
        blockNumber: group.blockNumber,
        name: group.name,
      },
    })

    // Add events to this conflict group
    for (const eventSlug of group.events) {
      const eventId = cEventMap.get(eventSlug)
      if (eventId) {
        await prisma.conflictGroupEvent.create({
          data: {
            conflictGroupId: conflictGroup.id,
            eventId,
          },
        })
      }
    }
  }
  console.log(`✅ Created ${divisionCConflictGroups.length} Division C conflict groups`)

  // Create a map of slug -> eventId for Division B
  const bEventMap = new Map(createdBEvents.map(e => [e.slug, e.id]))

  // Seed Division B Conflict Groups
  console.log('🔗 Seeding Division B conflict groups...')
  for (const group of divisionBConflictGroups) {
    const conflictGroup = await prisma.conflictGroup.create({
      data: {
        division: Division.B,
        blockNumber: group.blockNumber,
        name: group.name,
      },
    })

    // Add events to this conflict group
    for (const eventSlug of group.events) {
      const eventId = bEventMap.get(eventSlug)
      if (eventId) {
        await prisma.conflictGroupEvent.create({
          data: {
            conflictGroupId: conflictGroup.id,
            eventId,
          },
        })
      }
    }
  }
  console.log(`✅ Created ${divisionBConflictGroups.length} Division B conflict groups`)

  console.log('✅ Seed completed successfully!')
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
