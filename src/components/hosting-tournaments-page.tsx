'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Plus, Loader2, CheckCircle2, Search, Monitor, User, Mail, ExternalLink, MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatDivision } from '@/lib/utils'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface HostingTournamentsPageProps {
  isLoggedIn?: boolean
}

interface Tournament {
  id: string
  name: string
  division: 'B' | 'C' | 'B&C'
  description: string | null
  isOnline: boolean
  location: string | null
  hostingRequest: {
    division: string
    tournamentLevel: string
    tournamentFormat: string
    directorName: string
    directorEmail: string
    preferredSlug: string | null
  } | null
}

export function HostingTournamentsPage({ isLoggedIn = false }: HostingTournamentsPageProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugError, setSlugError] = useState<string>('')
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [emailError, setEmailError] = useState<string>('')
  const [phoneError, setPhoneError] = useState<string>('')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)
  const [search, setSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [formData, setFormData] = useState({
    tournamentName: '',
    tournamentLevel: '',
    division: '',
    tournamentFormat: '',
    location: '',
    preferredSlug: '',
    directorName: '',
    directorEmail: '',
    confirmEmail: '',
    directorPhone: '',
    otherNotes: '',
  })

  // Check slug availability
  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.trim() === '') {
      setSlugAvailable(null)
      setSlugError('')
      return
    }

    setSlugChecking(true)
    try {
      const response = await fetch(`/api/tournaments/check-slug?slug=${encodeURIComponent(slug.trim())}`)
      const data = await response.json()
      
      if (response.ok) {
        setSlugAvailable(data.available)
        setSlugError(data.available ? '' : data.message || 'This slug is already taken')
      } else {
        setSlugAvailable(false)
        setSlugError(data.error || 'Failed to check slug availability')
      }
    } catch (error) {
      console.error('Error checking slug:', error)
      setSlugAvailable(false)
      setSlugError('Failed to check slug availability')
    } finally {
      setSlugChecking(false)
    }
  }

  // Handle slug input change with debouncing
  const handleSlugChange = (value: string) => {
    const normalizedSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setFormData({ ...formData, preferredSlug: normalizedSlug })
    
    // Clear previous timeout
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current)
    }
    
    // Reset availability state
    setSlugAvailable(null)
    setSlugError('')
    
    // Debounce the slug check
    if (normalizedSlug.trim()) {
      slugCheckTimeoutRef.current = setTimeout(() => {
        checkSlugAvailability(normalizedSlug)
      }, 500) // Wait 500ms after user stops typing
    } else {
      setSlugAvailable(null)
      setSlugError('')
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.tournamentName || !formData.tournamentLevel || !formData.division || 
        !formData.tournamentFormat || !formData.directorName || !formData.directorEmail || !formData.confirmEmail) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.directorEmail)) {
      setEmailError('Please enter a valid email address')
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      })
      return
    }
    if (!emailRegex.test(formData.confirmEmail)) {
      setEmailError('Please enter a valid email address')
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      })
      return
    }

    // Validate phone number format if provided
    if (formData.directorPhone && formData.directorPhone.trim()) {
      // Allow various phone number formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 123 456 7890, etc.
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}[-\s\.]?[0-9]{1,9}$/
      const digitsOnly = formData.directorPhone.replace(/\D/g, '')
      if (digitsOnly.length < 10 || digitsOnly.length > 15 || !phoneRegex.test(formData.directorPhone)) {
        setPhoneError('Please enter a valid phone number (e.g., (555) 123-4567 or 555-123-4567)')
        toast({
          title: 'Invalid Phone Number',
          description: 'Please enter a valid phone number.',
          variant: 'destructive',
        })
        return
      }
    }

    // Validate emails match
    if (formData.directorEmail !== formData.confirmEmail) {
      toast({
        title: 'Email Mismatch',
        description: 'Email addresses do not match. Please check and try again.',
        variant: 'destructive',
      })
      return
    }

    if (formData.tournamentFormat === 'in-person' && !formData.location) {
      toast({
        title: 'Location Required',
        description: 'Please enter the tournament location for in-person events.',
        variant: 'destructive',
      })
      return
    }

    // Validate slug if provided
    if (formData.preferredSlug && formData.preferredSlug.trim()) {
      // If we haven't checked yet or it's checking, wait for the check
      if (slugChecking) {
        toast({
          title: 'Please Wait',
          description: 'Checking slug availability...',
          variant: 'default',
        })
        return
      }
      
      // If slug is not available, prevent submission
      if (slugAvailable === false) {
        toast({
          title: 'Slug Not Available',
          description: slugError || 'This slug is already taken. Please choose a different one.',
          variant: 'destructive',
        })
        return
      }
      
      // If we haven't checked yet, check now
      if (slugAvailable === null) {
        await checkSlugAvailability(formData.preferredSlug)
        // After checking, if not available, prevent submission
        const response = await fetch(`/api/tournaments/check-slug?slug=${encodeURIComponent(formData.preferredSlug.trim())}`)
        const data = await response.json()
        if (!data.available) {
          setSlugAvailable(false)
          setSlugError(data.message || 'This slug is already taken')
          toast({
            title: 'Slug Not Available',
            description: data.message || 'This slug is already taken. Please choose a different one.',
            variant: 'destructive',
          })
          return
        }
      }
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/tournament-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to submit form')
      }

      setSubmitted(true)
      toast({
        title: 'Request Submitted!',
        description: 'We will review your tournament hosting request and get back to you soon.',
      })
    } catch (error) {
      console.error('Error submitting form:', error)
      toast({
        title: 'Submission Failed',
        description: 'Please try again or contact us directly.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      tournamentName: '',
      tournamentLevel: '',
      division: '',
      tournamentFormat: '',
      location: '',
      preferredSlug: '',
      directorName: '',
      directorEmail: '',
      confirmEmail: '',
      directorPhone: '',
      otherNotes: '',
    })
    setSubmitted(false)
    setSlugAvailable(null)
    setSlugError('')
    setSlugChecking(false)
    setEmailError('')
    setPhoneError('')
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current)
    }
  }

  // Load tournaments on mount
  useEffect(() => {
    loadTournaments()
  }, [])

  const loadTournaments = async () => {
    try {
      setLoadingTournaments(true)
      const response = await fetch('/api/tournaments/public')
      if (!response.ok) throw new Error('Failed to load tournaments')
      const data = await response.json()
      setTournaments(data.tournaments || [])
    } catch (error) {
      console.error('Failed to load tournaments:', error)
    } finally {
      setLoadingTournaments(false)
    }
  }

  const filteredTournaments = tournaments.filter(t => {
    const hostingRequest = t.hostingRequest
    if (!hostingRequest) return false

    // Division filter
    if (divisionFilter !== 'all') {
      if (divisionFilter === 'B' && !hostingRequest.division.includes('B')) return false
      if (divisionFilter === 'C' && !hostingRequest.division.includes('C')) return false
    }
    // Level filter
    if (levelFilter !== 'all' && hostingRequest.tournamentLevel !== levelFilter) {
      return false
    }
    // Search
    if (search) {
      const searchLower = search.toLowerCase()
      const nameMatch = t.name.toLowerCase().includes(searchLower)
      const directorMatch = hostingRequest.directorName.toLowerCase().includes(searchLower)
      const locationMatch = t.location?.toLowerCase().includes(searchLower) || false
      if (!nameMatch && !directorMatch && !locationMatch) {
        return false
      }
    }
    return true
  })

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'in-person':
        return 'In-Person'
      case 'satellite':
        return 'Satellite'
      case 'mini-so':
        return 'Mini SO'
      default:
        return format
    }
  }

  const getTournamentSlug = (tournament: Tournament) => {
    if (tournament.hostingRequest?.preferredSlug) {
      return tournament.hostingRequest.preferredSlug
    }
    // Generate slug from tournament name
    return tournament.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleTournamentClick = (tournament: Tournament) => {
    const slug = getTournamentSlug(tournament)
    // Open tournament page in new tab - no login required for viewing
    window.open(`/tournaments/${slug}`, '_blank')
  }

  // Helper function to highlight search keywords in text
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery?.trim() || !text) {
      return text
    }

    const query = searchQuery.trim()
    const queryLower = query.toLowerCase()
    const textLower = text.toLowerCase()
    
    // Find all occurrences of the query in the text
    const indices: number[] = []
    let index = textLower.indexOf(queryLower)
    while (index !== -1) {
      indices.push(index)
      index = textLower.indexOf(queryLower, index + 1)
    }

    if (indices.length === 0) {
      return text
    }

    // Build array of parts (text segments and highlighted segments)
    const parts: Array<{ text: string; highlight: boolean }> = []
    let lastIndex = 0

    indices.forEach((startIndex) => {
      // Add text before the match
      if (startIndex > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, startIndex),
          highlight: false
        })
      }
      // Add the highlighted match
      parts.push({
        text: text.substring(startIndex, startIndex + query.length),
        highlight: true
      })
      lastIndex = startIndex + query.length
    })

    // Add remaining text after last match
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        highlight: false
      })
    }

    return (
      <>
        {parts.map((part, index) => {
          if (part.highlight) {
            return (
              <mark
                key={index}
                className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-0.5 rounded font-medium"
              >
                {part.text}
              </mark>
            )
          }
          return <span key={index}>{part.text}</span>
        })}
      </>
    )
  }

  return (
    <div className="py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            Host Tournaments
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Host your Science Olympiad tournament on teamy. Our platform streamlines every aspect of tournament management all in one place.
          </p>
        </div>

        {/* Demo Video Coming Soon */}
          <Card className="border-2 border-teamy-primary/20">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teamy-primary/10 text-teamy-primary font-semibold">
                DEMO VIDEO COMING SOON
              </div>
            </CardContent>
          </Card>

          {/* Host a Tournament Section */}
          <Card className="border-2 border-teamy-primary/20 bg-gradient-to-br from-teamy-primary/5 to-transparent">
            <CardHeader className="text-center pb-4 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 flex-wrap">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-teamy-primary" />
                Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-4 sm:px-6">
              {/* How it works */}
              <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-3 sm:p-4 rounded-lg bg-background/50">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teamy-primary/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="text-teamy-primary font-bold text-sm sm:text-base">1</span>
                  </div>
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">
                    Complete the{' '}
                    <a 
                      href="https://soinc.org/state-invitationalregional-directors-form" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-teamy-primary hover:underline"
                    >
                      Official Tournament Director&apos;s Form
                    </a>
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Review and follow the guidelines on the{' '}
                    <a 
                      href="https://soinc.org/play/invitationals" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-teamy-primary hover:underline"
                    >
                      official Science Olympiad website
                    </a>
                    . Please note that Teamy does not manage these requirements. For invitational tournaments, contact your State Director.
                  </p>
                </div>
                <div className="p-3 sm:p-4 rounded-lg bg-background/50">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teamy-primary/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="text-teamy-primary font-bold text-sm sm:text-base">2</span>
                  </div>
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Submit Request</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Provide your tournament details and contact information. Our team will verify that your tournament meets official requirements and Teamy&apos;s platform policies.
                  </p>
                </div>
                <div className="p-3 sm:p-4 rounded-lg bg-background/50 sm:col-span-1 md:col-span-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teamy-primary/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="text-teamy-primary font-bold text-sm sm:text-base">3</span>
                  </div>
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Wait for Approval</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Watch for an email with access to the Teamy tournament director portal. Our support team will manually review your request and provide updates.
                  </p>
                </div>
              </div>

              {/* Create Tournament Button */}
              <div className="text-center pt-2 sm:pt-4">
                <Dialog
                  open={dialogOpen}
                  onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (open) {
                      // Reset when re-opening to avoid success flash while closing
                      resetForm()
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                      Request Form
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {submitted ? (
                      <div className="py-12 text-center space-y-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                        <DialogTitle className="text-2xl">Request Submitted!</DialogTitle>
                        <DialogDescription className="text-base">
                          Thank you for your interest in hosting a tournament on Teamy. 
                          We&apos;ll review your request and get back to you within 2-3 business days.
                        </DialogDescription>
                        <Button
                          onClick={() => {
                            setDialogOpen(false)
                            // Don't reset form here - it will be reset when dialog opens again
                            // This prevents the form from flashing before the dialog closes
                          }}
                          className="mt-4"
                        >
                          Close
                        </Button>
                      </div>
                    ) : (
                      <>
                        <DialogHeader>
                          <DialogTitle>Tournament Hosting Request</DialogTitle>
                          <DialogDescription>
                            Fill out this form to request hosting your Science Olympiad tournament on Teamy.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmitForm} className="space-y-4 pt-4">
                          {/* Tournament Name */}
                          <div className="space-y-2">
                            <Label htmlFor="tournamentName">Tournament Name *</Label>
                            <Input
                              id="tournamentName"
                              value={formData.tournamentName}
                              onChange={(e) => setFormData({ ...formData, tournamentName: e.target.value })}
                              placeholder="e.g., Hylas SO"
                              required
                            />
                          </div>

                          {/* Tournament Level */}
                          <div className="space-y-2">
                            <Label htmlFor="tournamentLevel">Tournament Level *</Label>
                            <Select
                              value={formData.tournamentLevel}
                              onValueChange={(value) => setFormData({ ...formData, tournamentLevel: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select tournament level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="invitational">Invitational</SelectItem>
                                <SelectItem value="regional">Regional</SelectItem>
                                <SelectItem value="state">State</SelectItem>
                                <SelectItem value="national">National</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Division */}
                          <div className="space-y-2">
                            <Label htmlFor="division">Division *</Label>
                            <Select
                              value={formData.division}
                              onValueChange={(value) => setFormData({ ...formData, division: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select division" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="B">Division B</SelectItem>
                                <SelectItem value="C">Division C</SelectItem>
                                <SelectItem value="B&C">Division B & C</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Tournament Format */}
                          <div className="space-y-2">
                            <Label htmlFor="tournamentFormat">Tournament Format *</Label>
                            <Select
                              value={formData.tournamentFormat}
                              onValueChange={(value) => setFormData({ ...formData, tournamentFormat: value, location: value !== 'in-person' ? '' : formData.location })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="in-person">In-Person</SelectItem>
                                <SelectItem value="satellite">Satellite</SelectItem>
                                <SelectItem value="mini-so">Mini SO</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Location (only for in-person) */}
                          {formData.tournamentFormat === 'in-person' && (
                            <div className="space-y-2">
                              <Label htmlFor="location">Tournament Location *</Label>
                              <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="e.g., MIT Campus, Cambridge, MA"
                                required
                              />
                            </div>
                          )}

                          {/* Preferred Slug */}
                          <div className="space-y-2">
                            <Label htmlFor="preferredSlug">Preferred Website Slug</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">teamy.site/tournaments/</span>
                              <div className="flex-1 relative">
                                <Input
                                  id="preferredSlug"
                                  value={formData.preferredSlug}
                                  onChange={(e) => handleSlugChange(e.target.value)}
                                  placeholder="hylas"
                                  className={slugAvailable === false ? 'border-destructive' : slugAvailable === true ? 'border-green-500' : ''}
                                />
                                {slugChecking && (
                                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                                {!slugChecking && slugAvailable === true && formData.preferredSlug.trim() && (
                                  <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                                )}
                                {!slugChecking && slugAvailable === false && (
                                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-destructive text-sm">✕</span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Letters, numbers, and hyphens only. Leave blank for auto-generated.
                            </p>
                            {slugError && (
                              <p className="text-xs text-destructive">
                                {slugError}
                              </p>
                            )}
                            {!slugError && slugAvailable === true && formData.preferredSlug.trim() && (
                              <p className="text-xs text-green-600 dark:text-green-400">
                                This slug is available
                              </p>
                            )}
                          </div>

                          {/* Director Info */}
                          <div className="border-t pt-4 mt-4">
                            <h4 className="font-semibold mb-3">Tournament Director Information</h4>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="directorName">Full Name *</Label>
                                <Input
                                  id="directorName"
                                  value={formData.directorName}
                                  onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                                  placeholder="John Smith"
                                  required
                                />
                              </div>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="directorEmail">Email *</Label>
                                  <Input
                                    id="directorEmail"
                                    type="email"
                                    value={formData.directorEmail}
                                    onChange={(e) => {
                                      const email = e.target.value
                                      setFormData({ ...formData, directorEmail: email })
                                      // Validate email format
                                      if (email.trim()) {
                                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                                        if (!emailRegex.test(email)) {
                                          setEmailError('Please enter a valid email address')
                                        } else if (formData.confirmEmail && email !== formData.confirmEmail) {
                                          setEmailError('Email addresses do not match')
                                        } else {
                                          setEmailError('')
                                        }
                                      } else {
                                        setEmailError('')
                                      }
                                    }}
                                    placeholder="director@school.edu"
                                    required
                                    className={emailError ? 'border-destructive' : ''}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    TD portal access will be granted to this email upon approval.
                                  </p>
                                  {emailError && (
                                    <p className="text-xs text-destructive">{emailError}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="confirmEmail">Confirm Email *</Label>
                                  <Input
                                    id="confirmEmail"
                                    type="email"
                                    value={formData.confirmEmail}
                                    onChange={(e) => {
                                      const email = e.target.value
                                      setFormData({ ...formData, confirmEmail: email })
                                      // Validate email format
                                      if (email.trim()) {
                                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                                        if (!emailRegex.test(email)) {
                                          setEmailError('Please enter a valid email address')
                                        } else if (email !== formData.directorEmail) {
                                          setEmailError('Email addresses do not match')
                                        } else {
                                          setEmailError('')
                                        }
                                      } else {
                                        setEmailError('')
                                      }
                                    }}
                                    placeholder="director@school.edu"
                                    required
                                    className={emailError ? 'border-destructive' : ''}
                                  />
                                  {emailError && (
                                    <p className="text-xs text-destructive">{emailError}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="directorPhone">Phone Number</Label>
                                  <Input
                                    id="directorPhone"
                                    type="tel"
                                    value={formData.directorPhone}
                                    onChange={(e) => {
                                      const phone = e.target.value
                                      setFormData({ ...formData, directorPhone: phone })
                                      // Validate phone number format if provided
                                      if (phone.trim()) {
                                        const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}[-\s\.]?[0-9]{1,9}$/
                                        const digitsOnly = phone.replace(/\D/g, '')
                                        if (digitsOnly.length < 10 || digitsOnly.length > 15 || !phoneRegex.test(phone)) {
                                          setPhoneError('Please enter a valid phone number (e.g., (555) 123-4567 or 555-123-4567)')
                                        } else {
                                          setPhoneError('')
                                        }
                                      } else {
                                        setPhoneError('')
                                      }
                                    }}
                                    placeholder="(555) 123-4567"
                                    className={phoneError ? 'border-destructive' : ''}
                                  />
                                  {phoneError && (
                                    <p className="text-xs text-destructive">{phoneError}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Other Notes */}
                          <div className="space-y-2">
                            <Label htmlFor="otherNotes">Other Notes</Label>
                            <Textarea
                              id="otherNotes"
                              value={formData.otherNotes}
                              onChange={(e) => setFormData({ ...formData, otherNotes: e.target.value })}
                              placeholder="Any additional information about your tournament..."
                              rows={3}
                            />
                          </div>

                          {/* Submit Button */}
                          <div className="flex gap-4 pt-4">
                          <Button
                            type="submit"
                            disabled={submitting || (formData.preferredSlug.trim() && slugAvailable === false) || slugChecking || !!emailError || !!phoneError}
                            className="flex-1"
                          >
                              {submitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                'Submit Request'
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                            onClick={() => {
                              resetForm()
                              setDialogOpen(false)
                            }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Published Tournaments Section */}
          <div className="mt-12 sm:mt-16 space-y-6 sm:space-y-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
                Tournaments
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
                Discover approved Science Olympiad tournaments
              </p>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10 shrink-0" />
                  <Input
                    placeholder="Search tournaments..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12"
                  />
                </div>
                <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    <SelectItem value="B">Division B</SelectItem>
                    <SelectItem value="C">Division C</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="invitational">Invitational</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tournament List */}
            {loadingTournaments ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teamy-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading tournaments...</p>
              </div>
            ) : filteredTournaments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No tournaments found</h3>
                  <p className="text-muted-foreground">
                    {search || divisionFilter !== 'all' || levelFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'No approved tournaments at this time'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredTournaments.map((tournament) => {
                  const hostingRequest = tournament.hostingRequest
                  if (!hostingRequest) return null

                  return (
                    <Card
                      key={tournament.id}
                      className="hover:shadow-lg transition-all hover:border-teamy-primary/50 cursor-pointer h-full"
                      onClick={() => handleTournamentClick(tournament)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge variant="outline">Division {formatDivision(hostingRequest.division)}</Badge>
                          <Badge variant="outline">{getLevelLabel(hostingRequest.tournamentLevel)}</Badge>
                          <Badge variant="outline">{getFormatLabel(hostingRequest.tournamentFormat)}</Badge>
                        </div>
                        <CardTitle className="text-xl break-words leading-snug flex items-center gap-2">
                          {highlightText(tournament.name, search)}
                          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </CardTitle>
                        {tournament.description && (
                          <CardDescription className="line-clamp-2">
                            {tournament.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {hostingRequest.tournamentFormat === 'in-person' && tournament.location ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="line-clamp-1">{highlightText(tournament.location, search)}</span>
                          </div>
                        ) : hostingRequest.tournamentFormat !== 'in-person' ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Monitor className="h-4 w-4" />
                            <span>{getFormatLabel(hostingRequest.tournamentFormat)} Tournament</span>
                          </div>
                        ) : null}
                        
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>Director: {highlightText(hostingRequest.directorName, search)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>{hostingRequest.directorEmail}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

        {/* Questions Link */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">
            Have questions about hosting a tournament?{' '}
            <Link href="/contact" className="text-teamy-primary hover:underline font-semibold">
              Click here to contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

