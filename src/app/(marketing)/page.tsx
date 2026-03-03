import { PublicPageLayout } from '@/components/public-page-layout'
import { HomeHero } from '@/components/home-hero'

export const revalidate = 300

export default function HomePage() {
  return (
    <PublicPageLayout>
      <HomeHero />
    </PublicPageLayout>
  )
}
