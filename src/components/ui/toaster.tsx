"use client"

import { useEffect, useState } from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const [mounted, setMounted] = useState(false)
  const { toasts, dismiss } = useToast()

  // Render toasts only after mount to avoid hydration mismatch when browser
  // extensions (e.g. password managers) inject attributes into Radix's
  // VisuallyHidden div before React hydrates.
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props}
            onClick={() => dismiss(id)}
            className="cursor-pointer"
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose 
              onClick={(e) => {
                e.stopPropagation()
                dismiss(id)
              }}
            />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

