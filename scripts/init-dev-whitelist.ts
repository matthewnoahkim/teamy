import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultEmails = [
  'teamysite@gmail.com',
  'patkuanz@gmail.com',
  'samhongmu@gmail.com',
  '100033591@mvla.net',
  'jayrroy1@gmail.com',
  'mattnoahkim@gmail.com',
  '100032083@mvla.net',
]

async function initWhitelist() {
  try {
    console.log('Initializing dev panel email whitelist...')
    
    const existing = await prisma.siteSetting.findUnique({
      where: { key: 'dev_panel_email_whitelist' },
    })

    let currentEmails: string[] = []
    if (existing) {
      try {
        const parsed = JSON.parse(existing.value)
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentEmails = parsed.map((e: string) => e.toLowerCase().trim())
          console.log('Whitelist already exists with', currentEmails.length, 'emails')
          console.log('Current emails:', currentEmails)
        }
      } catch (_e) {
        console.log('Existing whitelist is invalid, replacing with defaults...')
      }
    }

    // Merge existing emails with default emails (avoid duplicates)
    const normalizedDefaults = defaultEmails.map(e => e.toLowerCase().trim())
    const merged = Array.from(new Set([...normalizedDefaults, ...currentEmails]))
    
    // Only update if there are changes
    const needsUpdate = merged.length !== currentEmails.length || 
      !normalizedDefaults.every(email => currentEmails.includes(email))

    if (!existing || needsUpdate) {
      await prisma.siteSetting.upsert({
        where: { key: 'dev_panel_email_whitelist' },
        update: { value: JSON.stringify(merged) },
        create: {
          key: 'dev_panel_email_whitelist',
          value: JSON.stringify(merged),
        },
      })

      if (needsUpdate) {
        console.log('✅ Whitelist updated with', merged.length, 'emails:')
      } else {
        console.log('✅ Whitelist initialized with', merged.length, 'emails:')
      }
      merged.forEach(email => console.log('  -', email))
    } else {
      console.log('✅ Whitelist already contains all default emails, no update needed')
    }
  } catch (error) {
    console.error('❌ Failed to initialize whitelist:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

initWhitelist()

