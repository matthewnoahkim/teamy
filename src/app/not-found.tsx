'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden grid-pattern bg-background">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-2xl">
        <div className="text-center space-y-8">
          {/* 404 Number with animation */}
          <div className="relative">
            <h1 
              className={`text-9xl md:text-[12rem] font-bold text-teamy-primary transition-all duration-1000 ${
                mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{
                fontFamily: 'Nunito, sans-serif',
                lineHeight: 1,
              }}
            >
              404
            </h1>
          </div>

          {/* Content card with backdrop blur */}
          <div 
            className={`rounded-3xl border border-border bg-card p-8 md:p-12 shadow-card transition-all duration-1000 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ 
              transitionDelay: '200ms'
            }}
          >
            <h2 
              className="text-3xl md:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: 'Nunito, sans-serif' }}
            >
              Page Not Found
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              Oops! The page you&apos;re looking for seems to have wandered off. 
              Let&apos;s get you back on track.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                asChild
                size="lg"
                className="group shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/">
                  <Home className="mr-2 h-5 w-5 group-hover:translate-x-[-2px] transition-transform" />
                  Go Home
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.back()}
                className="group shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <ArrowLeft className="mr-2 h-5 w-5 group-hover:translate-x-[-4px] transition-transform" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
