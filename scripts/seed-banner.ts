import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding initial banner settings...')

  // Create or update banner settings
  await prisma.siteSetting.upsert({
    where: { key: 'banner_enabled' },
    update: { value: 'true' },
    create: {
      key: 'banner_enabled',
      value: 'true',
    },
  })

  await prisma.siteSetting.upsert({
    where: { key: 'banner_text' },
    update: { value: 'This website is still a work in progress! Please report any issues to teamysite@gmail.com' },
    create: {
      key: 'banner_text',
      value: 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
    },
  })

  await prisma.siteSetting.upsert({
    where: { key: 'banner_link' },
    update: { value: '' },
    create: {
      key: 'banner_link',
      value: '',
    },
  })

  await prisma.siteSetting.upsert({
    where: { key: 'banner_background_color' },
    update: { value: '#8B5CF6' },
    create: {
      key: 'banner_background_color',
      value: '#8B5CF6',
    },
  })

  console.log('Banner settings seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

