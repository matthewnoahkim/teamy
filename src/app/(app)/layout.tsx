import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
import { FaviconLoader } from '@/components/favicon-loader'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FaviconLoader />
      <Providers>
        {children}
        <Toaster />
        <SpeedInsights />
        <Analytics />
      </Providers>
    </>
  )
}
