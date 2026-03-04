'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getYearOptions,
  isUnder13ForBirthDate,
  parseBirthMonthYear,
} from '@/lib/age-verification'

type AgeVerificationClientProps = {
  callbackUrl: string
  authenticated: boolean
  email?: string | null
  initialBirthMonth?: number | null
  initialBirthYear?: number | null
  initialParentConsent?: boolean
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

const YEAR_OPTIONS = getYearOptions()

function buildAgeVerificationCallbackUrl(
  callbackUrl: string,
  birthMonth: number,
  birthYear: number,
  parentConsent: boolean
): string {
  const params = new URLSearchParams({
    callbackUrl,
    birthMonth: String(birthMonth),
    birthYear: String(birthYear),
  })

  if (parentConsent) {
    params.set('parentConsent', '1')
  }

  return `/age-verification?${params.toString()}`
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // Ignore non-JSON error responses.
  }
  return 'Something went wrong. Please try again.'
}

export function AgeVerificationClient({
  callbackUrl,
  authenticated,
  email,
  initialBirthMonth = null,
  initialBirthYear = null,
  initialParentConsent = false,
}: AgeVerificationClientProps) {
  const [birthMonth, setBirthMonth] = useState<string>(initialBirthMonth ? String(initialBirthMonth) : '')
  const [birthYear, setBirthYear] = useState<string>(initialBirthYear ? String(initialBirthYear) : '')
  const [parentConsent, setParentConsent] = useState<boolean>(initialParentConsent)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedBirthDate = parseBirthMonthYear(birthMonth, birthYear)
  const isUnder13 = parsedBirthDate
    ? isUnder13ForBirthDate(parsedBirthDate.birthMonth, parsedBirthDate.birthYear)
    : false

  async function completeAgeVerification(params: {
    birthMonth: number
    birthYear: number
    parentConsent: boolean
  }) {
    const response = await fetch('/api/user/age-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response))
    }

    window.location.assign(callbackUrl)
  }

  const handleContinue = async () => {
    const parsed = parseBirthMonthYear(birthMonth, birthYear)
    if (!parsed) {
      setError('Please select your birth month and birth year.')
      return
    }

    const needsParentConsent = isUnder13ForBirthDate(parsed.birthMonth, parsed.birthYear)
    if (needsParentConsent && !parentConsent) {
      setError('Parent or guardian permission is required for users under 13.')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      if (authenticated) {
        await completeAgeVerification({
          birthMonth: parsed.birthMonth,
          birthYear: parsed.birthYear,
          parentConsent,
        })
        return
      }

      await signIn(
        'google',
        {
          callbackUrl: buildAgeVerificationCallbackUrl(
            callbackUrl,
            parsed.birthMonth,
            parsed.birthYear,
            parentConsent
          ),
        },
        {
          prompt: 'select_account',
        }
      )
      setIsLoading(false)
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : 'Something went wrong. Please try again.'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="birth-month">Birth month</Label>
          <Select value={birthMonth} onValueChange={setBirthMonth} disabled={isLoading}>
            <SelectTrigger id="birth-month" className="h-11 rounded-xl">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={String(month.value)}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth-year">Birth year</Label>
          <Select value={birthYear} onValueChange={setBirthYear} disabled={isLoading}>
            <SelectTrigger id="birth-year" className="h-11 rounded-xl">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isUnder13 && (
        <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Checkbox
            checked={parentConsent}
            onCheckedChange={(checked) => setParentConsent(checked === true)}
            disabled={isLoading}
            className="mt-0.5"
          />
          <span>
            I confirm I have parent or guardian permission to use this account email.
          </span>
        </label>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        className="h-12 w-full rounded-xl text-base font-semibold"
        onClick={handleContinue}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : !authenticated ? (
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        ) : null}
        {isLoading
          ? authenticated
            ? 'Saving...'
            : 'Connecting...'
          : authenticated
            ? 'Verify age and continue'
            : 'Continue with Google'}
      </Button>

      <p className="text-xs text-muted-foreground">
        {authenticated
          ? `Signed in as ${email || 'your account'}.`
          : 'Google sign-in verifies your email address to finish account setup.'}
      </p>
    </div>
  )
}
