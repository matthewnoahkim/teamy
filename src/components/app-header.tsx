'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/theme-toggle'
import { LogOut, Pencil, Settings, CreditCard, ChevronDown, Plus, Users as UsersIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/logo'
import { signOut } from 'next-auth/react'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { CreateClubDialog } from '@/components/create-club-dialog'
import { JoinClubDialog } from '@/components/join-club-dialog'
import { useState, useEffect } from 'react'

interface Club {
  id: string
  name: string
}

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
  clubId?: string // Current club ID
  clubs?: Club[] // List of clubs user belongs to
  allClubs?: Club[] // All clubs (for non-club pages like billing/customization)
  onClubChange?: (clubId: string) => void
  showCustomizationBilling?: boolean // Override to show customization/billing buttons
  currentPath?: string // Current path for highlighting active button
}

export function AppHeader({ user, showBackButton: _showBackButton = false, backHref: _backHref, title, clubId, clubs, allClubs, onClubChange: _onClubChange, showCustomizationBilling: showCustomizationBillingProp, currentPath }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)
  const [createClubOpen, setCreateClubOpen] = useState(false)
  const [joinClubOpen, setJoinClubOpen] = useState(false)
  
  // Show customization and billing on club pages OR when explicitly set
  const isOnClubPage = pathname?.startsWith('/club/')
  const showCustomizationBilling = showCustomizationBillingProp ?? isOnClubPage
  const showClubDropdown = (isOnClubPage && clubs && clubs.length > 0) || (allClubs && allClubs.length > 1)

  const currentClub = clubs?.find(c => c.id === clubId)
  const effectiveClubs = clubs || allClubs || []
  const effectivePath = currentPath || pathname

  useEffect(() => {
    // Warm route cache for quick club switching.
    for (const club of effectiveClubs) {
      if (club.id !== clubId) {
        router.prefetch(`/club/${club.id}`)
      }
    }
  }, [effectiveClubs, clubId, router])

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign out error', error)
    }
  }

  const handleClubChange = (newClubId: string) => {
    if (newClubId !== clubId) {
      // Save last visited club to cookie
      document.cookie = `lastVisitedClub=${newClubId}; path=/; max-age=${60 * 60 * 24 * 365}` // 1 year
      router.push(`/club/${newClubId}`)
    }
  }

  return (
    <>
      <header className="floating-bar-shell floating-bar-shell-top" suppressHydrationWarning>
        <div className="container mx-auto floating-bar-content px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Logo size="md" className="flex-shrink-0" href="/" variant="light" />
            
            {showClubDropdown ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm sm:text-base md:text-lg text-white font-semibold hover:bg-white/10 rounded-lg transition-colors truncate max-w-[150px] sm:max-w-[200px] md:max-w-[300px]">
                    <span className="truncate">{currentClub?.name || 'Clubs'}</span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Switch Club</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {effectiveClubs.map((club) => (
                    <DropdownMenuItem
                      key={club.id}
                      onClick={() => handleClubChange(club.id)}
                      className={club.id === clubId ? 'bg-accent' : ''}
                    >
                      <UsersIcon className="mr-2 h-4 w-4" />
                      {club.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setJoinClubOpen(true)}>
                    <UsersIcon className="mr-2 h-4 w-4" />
                    Join Club
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateClubOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Club
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : title ? (
              <h1 className="text-base sm:text-lg md:text-xl font-semibold text-white hidden md:block truncate">
                {title}
              </h1>
            ) : null}
            
            {showCustomizationBilling && (
              <>
                <div className="hidden lg:block h-6 w-px bg-white/20 mx-1" />
                <button
                  onClick={() => {
                    router.push(`/customization?from=${encodeURIComponent(pathname)}`)
                  }}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded-lg ${
                    effectivePath === '/customization'
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Customization</span>
                </button>
                <button
                  onClick={() => {
                    router.push(`/billing?from=${encodeURIComponent(pathname)}`)
                  }}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded-lg ${
                    effectivePath === '/billing'
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
                      onClick={() => router.push(`/customization?from=${encodeURIComponent(pathname)}`)} 
                      className="lg:hidden"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Customization
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => router.push(`/billing?from=${encodeURIComponent(pathname)}`)} 
                      className="lg:hidden"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-default">
                  <ThemeToggle variant="menu" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={setCurrentUserName}
      />

      <CreateClubDialog open={createClubOpen} onOpenChange={setCreateClubOpen} />
      <JoinClubDialog open={joinClubOpen} onOpenChange={setJoinClubOpen} />
    </>
  )
}
