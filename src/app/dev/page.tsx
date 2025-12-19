'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, FileText, Shield, CreditCard, LogOut, Trophy, ChevronDown, Mail, BarChart3, BookOpen } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

type Section = 'blog' | 'security' | 'tournaments' | 'email' | 'analytics' | 'payments' | 'resources'

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  { id: 'resources', label: 'Resources', icon: BookOpen },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'payments', label: 'Payments', icon: CreditCard },
]

export default function DevPage() {
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (typeof window !== 'undefined') {
      const savedSection = localStorage.getItem('dev-panel-active-section') as Section
      if (savedSection && ['blog', 'security', 'tournaments', 'email', 'analytics', 'payments', 'resources'].includes(savedSection)) {
        return savedSection
      }
    }
    return 'analytics'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('dev_auth') === 'true'
    }
    return false
  })
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [password, setPassword] = useState('')
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null)
  const [remainingTime, setRemainingTime] = useState(0)

  // Check for existing lockout on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLockout = localStorage.getItem('dev_lockout_end')
      const storedAttempts = localStorage.getItem('dev_failed_attempts')
      
      if (storedLockout) {
        const lockoutEnd = parseInt(storedLockout)
        if (lockoutEnd > Date.now()) {
          setLockoutEndTime(lockoutEnd)
          setFailedAttempts(parseInt(storedAttempts || '3'))
        } else {
          // Lockout expired, clear it
          localStorage.removeItem('dev_lockout_end')
          localStorage.removeItem('dev_failed_attempts')
        }
      } else if (storedAttempts) {
        setFailedAttempts(parseInt(storedAttempts))
      }
    }
  }, [])

  // Update remaining time every second when locked out
  useEffect(() => {
    if (lockoutEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000))
        setRemainingTime(remaining)
        
        if (remaining === 0) {
          setLockoutEndTime(null)
          setFailedAttempts(0)
          localStorage.removeItem('dev_lockout_end')
          localStorage.removeItem('dev_failed_attempts')
        }
      }, 1000)
      
      // Initial update
      const remaining = Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000))
      setRemainingTime(remaining)
      
      return () => clearInterval(interval)
    }
  }, [lockoutEndTime])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if locked out
    if (lockoutEndTime && lockoutEndTime > Date.now()) {
      return
    }
    
    setIsVerifying(true)
    
    try {
      const response = await fetch('/api/dev/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsAuthenticated(true)
        sessionStorage.setItem('dev_auth', 'true')
        setPassword('')
        // Reset failed attempts on success
        setFailedAttempts(0)
        localStorage.removeItem('dev_failed_attempts')
        localStorage.removeItem('dev_lockout_end')
      } else {
        if (data.debug) {
          console.error('Password verification failed:', data.debug)
        }
        
        const newAttempts = failedAttempts + 1
        setFailedAttempts(newAttempts)
        localStorage.setItem('dev_failed_attempts', newAttempts.toString())
        
        // Lock out after 3 failed attempts
        if (newAttempts >= 3) {
          const lockoutEnd = Date.now() + 60000 // 1 minute from now
          setLockoutEndTime(lockoutEnd)
          localStorage.setItem('dev_lockout_end', lockoutEnd.toString())
        }
        
        setErrorDialogOpen(true)
        setPassword('')
      }
    } catch (error) {
      console.error('Error verifying password:', error)
      
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      localStorage.setItem('dev_failed_attempts', newAttempts.toString())
      
      if (newAttempts >= 3) {
        const lockoutEnd = Date.now() + 60000
        setLockoutEndTime(lockoutEnd)
        localStorage.setItem('dev_lockout_end', lockoutEnd.toString())
      }
      
      setErrorDialogOpen(true)
      setPassword('')
    } finally {
      setIsVerifying(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStatus = sessionStorage.getItem('dev_auth') === 'true'
      setIsAuthenticated(authStatus)
    }
    setIsCheckingAuth(false)
  }, [])

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
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
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
                  Enter your development password to continue
                </p>
              </div>

              {lockoutEndTime && lockoutEndTime > Date.now() ? (
                <div className="space-y-4">
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">
                          Too many failed attempts
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please wait {remainingTime} second{remainingTime !== 1 ? 's' : ''} before trying again.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    className="w-full h-12"
                    disabled
                  >
                    Locked Out ({remainingTime}s)
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {failedAttempts > 0 && failedAttempts < 3 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
                        {3 - failedAttempts} attempt{3 - failedAttempts !== 1 ? 's' : ''} remaining before lockout
                      </p>
                    </div>
                  )}
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12"
                  />
                  <Button 
                    type="submit" 
                    className="w-full h-12"
                    disabled={isVerifying}
                  >
                    {isVerifying ? 'Verifying...' : 'Access Dev Panel'}
                  </Button>
                </form>
              )}
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
                  {failedAttempts >= 3 ? 'Account Locked' : 'Incorrect Password'}
                </DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                {failedAttempts >= 3 ? (
                  <>
                    Too many failed attempts. You have been locked out for 1 minute.
                  </>
                ) : (
                  <>
                    The password you entered is incorrect. You have {3 - failedAttempts} attempt{3 - failedAttempts !== 1 ? 's' : ''} remaining.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setErrorDialogOpen(false)}>
                {failedAttempts >= 3 ? 'Close' : 'Try Again'}
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
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo size="md" href="/" variant="light" />
            <span className="text-lg font-semibold text-white">Dev Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none text-white hover:text-white/80 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-sm font-semibold">D</span>
                  </div>
                  <span className="text-sm font-medium hidden sm:block">Developer</span>
                  <ChevronDown className="h-4 w-4 text-white/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    setIsAuthenticated(false)
                    sessionStorage.removeItem('dev_auth')
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

      <div className="flex pt-[65px]">
        {/* Sidebar */}
        <aside className="fixed left-0 top-[65px] bottom-0 w-52 border-r bg-card p-4">
          <nav className="space-y-1">
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
        </aside>

        {/* Main Content */}
        <main className="ml-52 flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              {navItems.find(item => item.id === activeSection)?.label}
            </h1>
          </div>

          {activeSection === 'analytics' && <AnalyticsDashboard />}

          {activeSection === 'email' && <EmailManager />}

          {activeSection === 'blog' && <BlogManager />}
          
          {activeSection === 'security' && <HealthTools />}
          
          {activeSection === 'tournaments' && <TournamentRequests />}
          
          {activeSection === 'resources' && <ResourceRequests />}
          
          {activeSection === 'payments' && (
            <div className="p-8 rounded-xl bg-card border">
              <div className="text-center py-16">
                <CreditCard className="h-16 w-16 mx-auto mb-6 text-muted-foreground/30" />
                <h2 className="text-xl font-semibold mb-2">Payment Management</h2>
                <p className="text-muted-foreground">Coming soon</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
