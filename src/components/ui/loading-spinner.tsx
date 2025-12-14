import { cn } from "@/lib/utils"

export type LoadingSpinnerVariant = "spinner" | "dots" | "pulse" | "bars" | "ring" | "orbit"
export type LoadingSpinnerSize = "xs" | "sm" | "md" | "lg" | "xl"

interface LoadingSpinnerProps {
  variant?: LoadingSpinnerVariant
  size?: LoadingSpinnerSize
  className?: string
  label?: string
}

const sizeClasses = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
}

const dotSizes = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3.5 h-3.5",
  xl: "w-5 h-5",
}

const barSizes = {
  xs: "w-0.5 h-3",
  sm: "w-0.5 h-4",
  md: "w-1 h-5",
  lg: "w-1.5 h-7",
  xl: "w-2 h-10",
}

export function LoadingSpinner({
  variant = "spinner",
  size = "md",
  className,
  label,
}: LoadingSpinnerProps) {
  const renderSpinner = () => {
    switch (variant) {
      case "spinner":
        return (
          <div className={cn("relative", sizeClasses[size], className)}>
            <svg
              className="animate-spin text-primary"
              style={{ animation: "spin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite" }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )

      case "dots":
        return (
          <div className={cn("flex items-center gap-2", className)}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full bg-primary shadow-md",
                  dotSizes[size]
                )}
                style={{
                  animation: `bounce 1.4s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
        )

      case "pulse":
        return (
          <div className={cn("relative", sizeClasses[size], className)}>
            <div 
              className="absolute inset-0 rounded-full bg-primary/40"
              style={{
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
            <div 
              className="absolute inset-0 rounded-full bg-primary shadow-lg"
              style={{
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
            <div className="absolute inset-2 rounded-full bg-primary/80" />
          </div>
        )

      case "bars":
        return (
          <div className={cn("flex items-end gap-1.5", className)}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "bg-primary rounded-sm shadow-md",
                  barSizes[size]
                )}
                style={{
                  animation: `barWave 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )

      case "ring":
        return (
          <div
            className={cn(
              "relative rounded-full border-4 border-primary/10",
              sizeClasses[size],
              className
            )}
            style={{
              animation: "spin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite",
            }}
          >
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary/50" />
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-primary/70" />
          </div>
        )

      case "orbit":
        return (
          <div className={cn("relative", sizeClasses[size], className)}>
            {/* Outer ring */}
            <div 
              className="absolute inset-0 rounded-full border-2 border-primary/10"
            />
            {/* Main orbit */}
            <div 
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
              style={{
                animation: "spin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite",
              }}
            />
            {/* Reverse orbit */}
            <div
              className="absolute inset-1 rounded-full border-2 border-transparent border-b-primary/70"
              style={{ 
                animation: "spin 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite reverse",
              }}
            />
            {/* Center dot */}
            <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-lg" />
          </div>
        )

      default:
        return null
    }
  }

  if (label) {
    return (
      <div className="flex flex-col items-center gap-3">
        {renderSpinner()}
        <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
      </div>
    )
  }

  return renderSpinner()
}

// Fullscreen loading overlay
interface LoadingOverlayProps {
  message?: string
  variant?: LoadingSpinnerVariant
}

export function LoadingOverlay({ message = "Loading...", variant = "orbit" }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
      <div className="relative flex flex-col items-center gap-6 p-10 rounded-3xl bg-gradient-to-br from-card/95 to-card/90 backdrop-blur-xl border border-border/60 shadow-2xl">
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded-3xl bg-primary/5 pointer-events-none" />
        <div className="relative">
          <LoadingSpinner variant={variant} size="xl" />
        </div>
        <div className="relative text-center">
          <p className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            {message}
          </p>
          <div className="mt-3 flex gap-1.5 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/50"
                style={{
                  animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Button loading spinner
interface ButtonLoadingProps {
  className?: string
  size?: LoadingSpinnerSize
}

export function ButtonLoading({ className, size = "sm" }: ButtonLoadingProps) {
  return <LoadingSpinner variant="spinner" size={size} className={cn("mr-2", className)} />
}

// Inline loading text with spinner
interface LoadingTextProps {
  text?: string
  variant?: LoadingSpinnerVariant
  size?: LoadingSpinnerSize
  className?: string
}

export function LoadingText({
  text = "Loading...",
  variant = "dots",
  size = "sm",
  className,
}: LoadingTextProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LoadingSpinner variant={variant} size={size} />
      <span className="text-sm font-medium text-muted-foreground animate-pulse">{text}</span>
    </div>
  )
}

// Page loading skeleton
interface PageLoadingProps {
  title?: string
  description?: string
  variant?: LoadingSpinnerVariant
}

export function PageLoading({
  title = "Loading content",
  description,
  variant = "orbit",
}: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-8 py-16">
      {/* Main spinner container with glow */}
      <div className="relative">
        <div 
          className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-150"
          style={{
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div className="relative">
          <LoadingSpinner variant={variant} size="lg" />
        </div>
      </div>
      
      {/* Text content */}
      <div className="text-center space-y-3 max-w-md px-4">
        <h3 className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed animate-pulse">
            {description}
          </p>
        )}
        
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center pt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary/60"
              style={{
                animation: "bounce 1.4s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

