'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

  // Close menus when route changes.
  useEffect(() => {
    setMobileMenuOpen(false)
    setOpenDropdown(null)
  }, [pathname])

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Prevent background scrolling when mobile menu is open.
  useEffect(() => {
    if (!mobileMenuOpen || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileMenuOpen])

  // Close menu/dropdowns with Escape for keyboard users.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        setOpenDropdown(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Calculate dropdown position when opened
  useEffect(() => {
    if (openDropdown && buttonRefs.current[openDropdown]) {
      const button = buttonRefs.current[openDropdown]
      const buttonRect = button.getBoundingClientRect()
      // Use the header's bottom edge so the dropdown always appears
      // consistently below the floating bar, regardless of banner state.
      const header = button.closest('header')
      setDropdownPosition({
        top: header ? header.getBoundingClientRect().bottom : buttonRect.bottom,
        left: buttonRect.left,
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
                  onClick={() => {
                    setOpenDropdown((prev) => (prev === item.label ? null : item.label))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setOpenDropdown((prev) => (prev === item.label ? null : item.label))
                    }
                  }}
                  aria-expanded={openDropdown === item.label}
                  aria-haspopup="menu"
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
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openDropdown === item.label ? "rotate-180" : ""
                    )}
                  />
                </button>
              </div>
            )
          }
        })}
      </nav>

      {/* Dropdown Portal - Rendered via createPortal to document.body so that
          fixed positioning is relative to the viewport, not the header
          (whose backdrop-filter creates a containing block). */}
      {openDropdown && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] mt-2"
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
            "w-60 rounded-lg shadow-xl border backdrop-blur-xl",
            isLight
              ? "bg-popover border-border"
              : "bg-background border-border"
          )} role="menu">
            <div className="p-1.5">
              {navItems
                .find(item => item.label === openDropdown)
                ?.items?.map((subItem) => {
                  const active = isActive(subItem.href)
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      onClick={() => setOpenDropdown(null)}
                      role="menuitem"
                      className={cn(
                        "block px-3 py-2 rounded-md transition-colors text-base leading-tight font-sans font-medium",
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
        </div>,
        document.body
      )}

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="home-mobile-menu"
          className={cn(
            "p-2 transition-colors relative z-[10001]",
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
      </div>

      {/* Mobile Menu - Portal to body for proper full-width positioning */}
      {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu panel */}
          <div className={cn(
            "fixed top-0 right-0 z-[9999] w-[280px] max-w-[85vw] h-full overflow-y-auto shadow-2xl md:hidden",
            "transform transition-transform duration-200 ease-out",
            isLight 
              ? "bg-teamy-primary dark:bg-popover border-l border-white/10" 
              : "bg-background border-l border-border"
          )} id="home-mobile-menu">
            <div className="pt-16 pb-6 px-4">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  if (item.href) {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors",
                          isLight 
                            ? active
                              ? "text-white bg-white/15"
                              : "text-white/80 hover:text-white hover:bg-white/10"
                            : active
                              ? "text-foreground bg-teamy-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  } else {
                    return (
                      <div key={item.label} className="py-2">
                        <div className={cn(
                          "text-xs font-bold uppercase tracking-wider px-3 mb-2",
                          isLight ? "text-white/50" : "text-muted-foreground"
                        )}>
                          {item.label}
                        </div>
                        <div className="space-y-0.5">
                          {item.items?.map((subItem) => {
                            const active = isActive(subItem.href)
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  "block text-sm font-medium py-2.5 px-3 pl-5 rounded-lg transition-colors",
                                  isLight 
                                    ? active
                                      ? "text-white bg-white/15"
                                      : "text-white/80 hover:text-white hover:bg-white/10"
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
                  <div className="pt-3 mt-2 border-t border-white/10" onClick={() => setMobileMenuOpen(false)}>
                    {mobileButton}
                  </div>
                )}
              </nav>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
