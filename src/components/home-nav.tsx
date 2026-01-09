'use client'

import { useState, useRef, useEffect } from 'react'
import type React from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href?: string
  items?: { label: string; href: string; description?: string }[]
}

const navItems: NavItem[] = [
  {
    label: 'Solutions',
    items: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Tournament Listings', href: '/tournament-listings' },
      { label: 'Hosting a Tournament', href: '/host-tournament' },
    ],
  },
  {
    label: 'Initiatives',
    items: [
      { label: 'Grants', href: '/grants' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    label: 'Connect',
    items: [
      { label: 'About', href: '/about' },
      { label: 'Partnerships', href: '/partnerships' },
      { label: 'Help Center', href: '/help' },
      { label: 'Contact', href: '/contact' },
    ],
  },
]

interface HomeNavProps {
  variant?: 'default' | 'hero' | 'light'
  mobileButton?: React.ReactNode
}

interface DropdownPosition {
  top: number
  left: number
}

export function HomeNav({ variant = 'default', mobileButton }: HomeNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 })
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pathname = usePathname()

  // 'light' and 'hero' both use white text for blue backgrounds
  const isLight = variant === 'hero' || variant === 'light'

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Calculate dropdown position when opened
  useEffect(() => {
    if (openDropdown && buttonRefs.current[openDropdown]) {
      const button = buttonRefs.current[openDropdown]
      const rect = button.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
      })
    }
  }, [openDropdown])

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  // Check if dropdown has active child
  const hasActiveChild = (items?: { href: string }[]) => {
    if (!items) return false
    return items.some(item => isActive(item.href))
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-8">
        {navItems.map((item) => {
          if (item.href) {
            // Simple link
            const active = isActive(item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "text-sm font-semibold transition-all duration-200 rounded-xl px-4 py-2",
                  isLight 
                    ? active
                      ? "text-white bg-white/20 backdrop-blur-sm shadow-lg"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                    : active
                      ? "text-foreground bg-background shadow-lg backdrop-blur-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {item.label}
              </Link>
            )
          } else {
            // Dropdown menu
            const hasActive = hasActiveChild(item.items)
            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => {
                  if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current)
                    closeTimeoutRef.current = null
                  }
                  setOpenDropdown(item.label)
                }}
                onMouseLeave={() => {
                  closeTimeoutRef.current = setTimeout(() => {
                    setOpenDropdown(null)
                  }, 150)
                }}
              >
                <button
                  ref={(el) => {
                    buttonRefs.current[item.label] = el
                  }}
                  className={cn(
                    "text-sm font-semibold transition-all duration-200 flex items-center gap-1 rounded-xl px-4 py-2",
                    isLight 
                      ? hasActive
                        ? "text-white bg-white/20 backdrop-blur-sm shadow-lg"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                      : hasActive
                        ? "text-foreground bg-background shadow-lg backdrop-blur-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  {item.label}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )
          }
        })}
      </nav>

      {/* Dropdown Portal - Rendered outside container */}
      {openDropdown && (
        <div
          className="fixed z-[9999] mt-1.5"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
          onMouseEnter={() => {
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current)
              closeTimeoutRef.current = null
            }
          }}
          onMouseLeave={() => {
            closeTimeoutRef.current = setTimeout(() => {
              setOpenDropdown(null)
            }, 150)
          }}
        >
          <div className={cn(
            "w-64 rounded-xl shadow-xl border backdrop-blur-xl",
            isLight
              ? "bg-popover border-border"
              : "bg-background border-border"
          )}>
            <div className="p-2 space-y-2">
              {navItems
                .find(item => item.label === openDropdown)
                ?.items?.map((subItem) => {
                  const active = isActive(subItem.href)
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={cn(
                        "block px-4 py-3 rounded-lg transition-colors text-base leading-tight font-sans font-medium",
                        active
                          ? "bg-teamy-primary/10 text-teamy-primary"
                          : "text-foreground hover:bg-secondary"
                      )}
                    >
                      {subItem.label}
                    </Link>
                  )
                })}
            </div>
          </div>
        </div>
      )}

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
            "absolute top-full left-0 right-0 border-b backdrop-blur-xl max-h-[80vh] overflow-y-auto",
            isLight 
              ? "bg-teamy-primary/95 dark:bg-popover/95 border-white/10" 
              : "bg-background/95 border-border"
          )}>
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-1">
              {navItems.map((item) => {
                if (item.href) {
                  // Simple link
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "text-sm font-semibold py-2 px-3 rounded-lg transition-colors relative",
                        isLight 
                          ? active
                            ? "text-white bg-white/10"
                            : "text-white/80 hover:text-white hover:bg-white/5"
                          : active
                            ? "text-foreground bg-teamy-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                } else {
                  // Category with items
                  return (
                    <div key={item.label} className="py-2">
                      <div className={cn(
                        "text-xs font-bold uppercase tracking-wider px-3 mb-2",
                        isLight ? "text-white/60" : "text-muted-foreground"
                      )}>
                        {item.label}
                      </div>
                      <div className="space-y-1">
                        {item.items?.map((subItem) => {
                          const active = isActive(subItem.href)
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "block text-sm font-medium py-2 px-3 pl-6 rounded-lg transition-colors",
                                isLight 
                                  ? active
                                    ? "text-white bg-white/10"
                                    : "text-white/80 hover:text-white hover:bg-white/5"
                                  : active
                                    ? "text-foreground bg-teamy-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                              )}
                            >
                              {subItem.label}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
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
