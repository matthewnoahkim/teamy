'use client'

import { useState } from 'react'
import { Trophy, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function HostTournamentContent() {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
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
  }

  return (
    <div className="py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            Hosting a Tournament
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
                            <Input
                              id="preferredSlug"
                              value={formData.preferredSlug}
                              onChange={(e) => setFormData({ ...formData, preferredSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                              placeholder="hylas"
                              className="flex-1"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Letters, numbers, and hyphens only. Leave blank for auto-generated.
                          </p>
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
                                  onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                                  placeholder="director@school.edu"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="confirmEmail">Confirm Email *</Label>
                                <Input
                                  id="confirmEmail"
                                  type="email"
                                  value={formData.confirmEmail}
                                  onChange={(e) => setFormData({ ...formData, confirmEmail: e.target.value })}
                                  placeholder="director@school.edu"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="directorPhone">Phone Number</Label>
                                <Input
                                  id="directorPhone"
                                  type="tel"
                                  value={formData.directorPhone}
                                  onChange={(e) => setFormData({ ...formData, directorPhone: e.target.value })}
                                  placeholder="(555) 123-4567"
                                />
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
                            disabled={submitting}
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

