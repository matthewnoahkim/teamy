'use client'

import { useState } from 'react'
import type React from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Host Tournaments', href: '/tournaments' },
  { label: 'Grants', href: '/grants' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

interface HomeNavProps {
  variant?: 'default' | 'hero' | 'light'
  mobileButton?: React.ReactNode
}

export function HomeNav({ variant = 'default', mobileButton }: HomeNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // 'light' and 'hero' both use white text for blue backgrounds
  const isLight = variant === 'hero' || variant === 'light'

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-8">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-semibold transition-colors relative",
                isLight 
                  ? active
                    ? "text-white"
                    : "text-white/80 hover:text-white"
                  : active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
              {active && (
                <span className={cn(
                  "absolute -bottom-1 left-0 right-0 h-0.5 rounded-full",
                  isLight ? "bg-white" : "bg-teamy-primary dark:bg-teamy-accent"
                )} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={cn(
            "p-2 transition-colors",
            isLight 
              ? "text-white/80 hover:text-white" 
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
        
        {mobileMenuOpen && (
          <div className={cn(
            "absolute top-full left-0 right-0 border-b backdrop-blur-xl",
            isLight 
              ? "bg-teamy-primary/95 dark:bg-slate-900/95 border-white/10" 
              : "bg-background/95 border-border"
          )}>
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-4">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "text-sm font-semibold py-2 transition-colors relative",
                      isLight 
                        ? active
                          ? "text-white"
                          : "text-white/80 hover:text-white"
                        : active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                    {active && (
                      <span className={cn(
                        "absolute left-0 bottom-0 top-0 w-1 rounded-r-full",
                        isLight ? "bg-white" : "bg-teamy-primary dark:bg-teamy-accent"
                      )} />
                    )}
                  </Link>
                )
              })}
              {mobileButton && (
                <div className="pt-2" onClick={() => setMobileMenuOpen(false)}>
                  {mobileButton}
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </>
  )
}
