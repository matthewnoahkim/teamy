'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertTriangle, FileText, Shield, CreditCard, LogOut, Trophy, ChevronDown, Mail, BarChart3, BookOpen, Megaphone, Tag, History, Pencil } from 'lucide-react'
import { SignInButton } from '@/components/signin-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { HealthTools } from '@/components/dev/health-tools'
import { BlogManager } from '@/components/dev/blog-manager'
import { TournamentRequests } from '@/components/dev/tournament-requests'
import { EmailManager } from '@/components/dev/email-manager'
import { AnalyticsDashboard } from '@/components/dev/analytics-dashboard'
import { ResourceRequests } from '@/components/dev/resource-requests'
import { BannerManager } from '@/components/dev/banner-manager'
import { PromoCodeManager } from '@/components/dev/promo-code-manager'
import { AuditLogViewer } from '@/components/dev/audit-log-viewer'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

type Section = 'blog' | 'security' | 'tournaments' | 'email' | 'analytics' | 'payments' | 'resources' | 'banner' | 'promo' | 'audit'

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'banner', label: 'Site Banner', icon: Megaphone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  { id: 'resources', label: 'Resources', icon: BookOpen },
  { id: 'promo', label: 'Promo Codes', icon: Tag },
  { id: 'audit', label: 'Audit Logs', icon: History },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'payments', label: 'Payments', icon: CreditCard },
]

export default function DevPage() {
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (typeof window !== 'undefined') {
      const savedSection = localStorage.getItem('dev-panel-active-section') as Section
      if (savedSection && ['blog', 'security', 'tournaments', 'email', 'analytics', 'payments', 'resources', 'banner', 'promo', 'audit'].includes(savedSection)) {
        return savedSection
      }
    }
    return 'analytics'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)

  const { data: session, status } = useSession()

  // Update currentUserName when session changes
  useEffect(() => {
    if (session?.user?.name) {
      setCurrentUserName(session.user.name)
    }
  }, [session])

  // Check authentication status
  useEffect(() => {
    if (status === 'loading') {
      setIsCheckingAuth(true)
      return
    }

    if (status === 'unauthenticated' || !session?.user?.email) {
      setIsAuthenticated(false)
      setIsCheckingAuth(false)
      return
    }

    // Verify email is in whitelist
    const verifyAccess = async () => {
      setIsVerifying(true)
      try {
        const response = await fetch('/api/dev/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
          if (response.status === 403) {
            setErrorDialogOpen(true)
          }
        }
      } catch (error) {
        console.error('Error verifying access:', error)
        setIsAuthenticated(false)
      } finally {
        setIsVerifying(false)
        setIsCheckingAuth(false)
      }
    }

    verifyAccess()
  }, [session, status])

  // Save active section to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dev-panel-active-section', activeSection)
    }
  }, [activeSection])

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background grid-pattern">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground grid-pattern">
        {/* Header */}
        <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Logo size="md" href="/" variant="light" />
          </div>
        </header>

        {/* Login Form */}
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="p-8 rounded-2xl bg-card border shadow-nav space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Dev Access</h1>
                <p className="text-muted-foreground">
                  Sign in with Google to access the dev panel
                </p>
              </div>

              <div className="space-y-4">
                {status === 'loading' || isVerifying ? (
                  <Button 
                    type="button" 
                    className="w-full h-12"
                    disabled
                  >
                    Verifying access...
                  </Button>
                ) : (
                  <SignInButton callbackUrl="/dev" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Dialog */}
        <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 dark:bg-red-500/20 p-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <DialogTitle>
                  Access Denied
                </DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                Your email is not authorized to access the dev panel. Please contact an administrator to request access.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setErrorDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Main dev panel with sidebar (club page style)
  return (
    <div className="min-h-screen bg-background text-foreground grid-pattern">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo size="md" href="/" variant="light" />
            <span className="text-lg font-semibold text-white">Dev Panel</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-3 outline-none">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all">
                    <AvatarImage src={session?.user?.image || ''} />
                    <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                      {currentUserName?.charAt(0) || session?.user?.email?.charAt(0).toUpperCase() || 'D'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left max-w-[120px] md:max-w-none">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {currentUserName || session?.user?.email?.split('@')[0] || 'Developer'}
                    </p>
                    <p className="text-[10px] sm:text-xs text-white/60 truncate">{session?.user?.email || ''}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/60 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setEditUsernameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Username
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut({ callbackUrl: '/dev' })
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 max-w-full overflow-x-hidden">
        <div className="flex gap-4 sm:gap-6 lg:gap-8 items-start">
          {/* Sidebar */}
          <aside className="w-48 lg:w-52 flex-shrink-0 hidden md:block self-start">
            <div className="sticky top-24 will-change-transform">
              <nav className="space-y-2 bg-card/80 backdrop-blur-sm border border-border/50 p-3 rounded-2xl shadow-lg">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0 md:pl-0 flex flex-col min-h-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              {navItems.find(item => item.id === activeSection)?.label}
            </h1>
          </div>

          {activeSection === 'analytics' && <AnalyticsDashboard />}

          {activeSection === 'banner' && <BannerManager />}

          {activeSection === 'email' && <EmailManager />}

          {activeSection === 'blog' && <BlogManager />}
          
          {activeSection === 'security' && <HealthTools />}
          
          {activeSection === 'tournaments' && <TournamentRequests />}
          
          {activeSection === 'resources' && <ResourceRequests />}
          
          {activeSection === 'promo' && <PromoCodeManager />}
          
          {activeSection === 'audit' && <AuditLogViewer />}
          
          {activeSection === 'payments' && (
            <div className="p-8 rounded-xl bg-card border">
              <div className="text-center py-16">
                <CreditCard className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
                <h2 className="text-xl font-semibold mb-2">Payment Management</h2>
                <p className="text-muted-foreground">Coming soon</p>
              </div>
            </div>
          )}
          </div>
        </div>
      </main>

      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={setCurrentUserName}
      />
    </div>
  )
}
