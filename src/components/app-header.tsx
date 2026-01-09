'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/theme-toggle'
import { LogOut, Pencil, ArrowLeft, Settings, CreditCard, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/logo'
import { signOut } from 'next-auth/react'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { useState } from 'react'

interface AppHeaderProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  showBackButton?: boolean
  backHref?: string
  title?: string
}

export function AppHeader({ user, showBackButton = false, backHref, title }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)
  
  // Show customization and billing only on club dashboard pages (not tournament pages)
  const isOnClubDashboard = pathname?.startsWith('/dashboard') ||
                            pathname === '/dashboard/customization' || 
                            pathname === '/dashboard/billing'
  const isOnESPortal = pathname?.startsWith('/es')
  const isOnTDPortal = pathname?.startsWith('/td')
  const showCustomizationBilling = isOnClubDashboard && !isOnESPortal && !isOnTDPortal

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign out error', error)
    }
  }

  return (
    <>
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl" suppressHydrationWarning>
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            {showBackButton && backHref && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(backHref)}
                className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
            <Logo size="md" className="flex-shrink-0" href="/" variant="light" />
            {title && (
              <h1 className="text-base sm:text-lg md:text-xl font-semibold text-white hidden md:block truncate">
                {title}
              </h1>
            )}
            {showCustomizationBilling && (
              <>
                <div className="hidden md:block h-6 w-px bg-white/20 mx-1" />
                <button
                  onClick={() => {
                    const from = 'clubs'
                    router.push(`/dashboard/customization?from=${from}`)
                  }}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded-lg ${
                    pathname === '/dashboard/customization'
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Customization</span>
                </button>
                <button
                  onClick={() => {
                    const from = 'clubs'
                    router.push(`/dashboard/billing?from=${from}`)
                  }}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded-lg ${
                    pathname === '/dashboard/billing'
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Billing</span>
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-3 outline-none">
                  <Avatar 
                    className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all"
                  >
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                      {currentUserName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left max-w-[120px] md:max-w-none">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {currentUserName || user.email}
                    </p>
                    <p className="text-[10px] sm:text-xs text-white/60 truncate">{user.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/60 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setEditUsernameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Username
                </DropdownMenuItem>
                {showCustomizationBilling && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => {
                        const from = 'clubs'
                        router.push(`/dashboard/customization?from=${from}`)
                      }} 
                      className="md:hidden"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Customization
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        const from = 'clubs'
                        router.push(`/dashboard/billing?from=${from}`)
                      }} 
                      className="md:hidden"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={setCurrentUserName}
      />
    </>
  )
}
