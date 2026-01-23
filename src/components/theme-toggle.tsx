"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  variant?: 'default' | 'header' | 'menu'
}

export function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="h-9 w-14 flex items-center justify-center">
        <div className="h-5 w-10 rounded-full bg-input animate-pulse" />
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  if (variant === 'menu') {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {isDark ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="text-sm">Theme</span>
        </div>
        <Switch
          checked={isDark}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          suppressHydrationWarning
          aria-label="Toggle theme"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Sun 
        className={cn(
          "h-4 w-4 transition-all duration-300",
          isDark 
            ? "text-muted-foreground/50" 
            : "text-foreground"
        )}
      />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        suppressHydrationWarning
        aria-label="Toggle theme"
      />
      <Moon 
        className={cn(
          "h-4 w-4 transition-all duration-300",
          isDark 
            ? "text-foreground" 
            : "text-muted-foreground/50"
        )}
      />
    </div>
  )
}
