'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Minimize2, Calculator as CalcIcon, GripVertical } from 'lucide-react'

type CalculatorType = 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING'

interface CalculatorProps {
  type: CalculatorType
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Position {
  x: number
  y: number
}

// Desmos API Key - loaded from environment variable
const DESMOS_API_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY || ''

// TypeScript declaration for Desmos
interface DesmosCalculatorInstance {
  destroy: () => void
  getState: () => Record<string, unknown>
  setState: (state: Record<string, unknown>) => void
  [key: string]: unknown
}

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (element: HTMLElement, options?: Record<string, unknown>) => DesmosCalculatorInstance
    }
  }
}

export function Calculator({ type, open, onOpenChange }: CalculatorProps) {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [newNumber, setNewNumber] = useState(true)
  const [memory, setMemory] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD'>('DEG')
  // Track last operation and operand for repeating equals
  const [lastOperation, setLastOperation] = useState<string | null>(null)
  const [lastOperand, setLastOperand] = useState<number | null>(null)
  const desmosCalculatorRef = useRef<DesmosCalculatorInstance | null>(null)
  const desmosContainerRef = useRef<HTMLDivElement>(null)
  const [desmosLoaded, setDesmosLoaded] = useState(false)
  const [desmosInitialized, setDesmosInitialized] = useState(false)
  const savedDesmosStateRef = useRef<Record<string, unknown> | null>(null)
  const [desmosLoadStartTime, setDesmosLoadStartTime] = useState<number | null>(null)
  const [showScientificFallback, setShowScientificFallback] = useState(false)
  const [calculatorSize, setCalculatorSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`calculator-size-${type}`)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Fallback to defaults
        }
      }
    }
    return {
      width: type === 'GRAPHING' ? 900 : 400,
      height: type === 'GRAPHING' ? 650 : 500,
    }
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's' | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  
  // Helper function to calculate centered position
  const getCenteredPosition = (): Position => {
    if (typeof window === 'undefined') {
      return { x: 100, y: 100 }
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const elementWidth = calculatorSize.width
    const elementHeight = calculatorSize.height
    
    const centeredX = (viewportWidth - elementWidth) / 2
    const centeredY = (viewportHeight - elementHeight) / 2
    
    return {
      x: Math.max(0, Math.round(centeredX)),
      y: Math.max(0, Math.round(centeredY))
    }
  }

  // Draggable position state - initialize to centered position
  const [position, setPosition] = useState<Position>(getCenteredPosition())
  const [isDragging, setIsDragging] = useState(false)
  const calculatorRef = useRef<HTMLDivElement>(null)
  const hasInitializedRef = useRef(false)
  const [isPositioned, setIsPositioned] = useState(false)
  
  // Handle resize mouse down
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, direction: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's') => {
    e.preventDefault()
    e.stopPropagation()
    
    if (calculatorRef.current) {
      const rect = calculatorRef.current.getBoundingClientRect()
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height,
      }
      setResizeDirection(direction)
      setIsResizing(true)
    }
  }
  
  // Handle resize mouse move
  useEffect(() => {
    if (!isResizing || !resizeStartRef.current || !resizeDirection) return
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none'
    document.body.style.cursor = `${resizeDirection}-resize`
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      if (!resizeStartRef.current) return
      
      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = e.clientY - resizeStartRef.current.y
      
      let newWidth = resizeStartRef.current.width
      let newHeight = resizeStartRef.current.height
      let newX = position.x
      let newY = position.y
      
      const minWidth = type === 'GRAPHING' ? 600 : 300
      const minHeight = type === 'GRAPHING' ? 400 : 300
      const maxWidth = window.innerWidth - 20
      const maxHeight = window.innerHeight - 20
      
      // Handle different resize directions
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartRef.current.width + deltaX))
      }
      if (resizeDirection.includes('w')) {
        const oldWidth = resizeStartRef.current.width
        newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartRef.current.width - deltaX))
        const widthChange = oldWidth - newWidth
        newX = Math.max(0, position.x + widthChange)
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartRef.current.height + deltaY))
      }
      if (resizeDirection.includes('n')) {
        const oldHeight = resizeStartRef.current.height
        newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartRef.current.height - deltaY))
        const heightChange = oldHeight - newHeight
        newY = Math.max(0, position.y + heightChange)
      }
      
      // Ensure calculator stays within viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      if (newX + newWidth > viewportWidth) {
        newWidth = Math.max(minWidth, viewportWidth - newX)
      }
      if (newY + newHeight > viewportHeight) {
        newHeight = Math.max(minHeight, viewportHeight - newY)
      }
      if (newX < 0) {
        newWidth = Math.max(minWidth, newWidth + newX)
        newX = 0
      }
      if (newY < 0) {
        newHeight = Math.max(minHeight, newHeight + newY)
        newY = 0
      }
      
      setCalculatorSize({ width: newWidth, height: newHeight })
      setPosition({ x: newX, y: newY })
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDirection(null)
      resizeStartRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true })
    document.addEventListener('mouseup', handleMouseUp, { capture: true })
    window.addEventListener('mouseup', handleMouseUp, { capture: true })
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true })
      document.removeEventListener('mouseup', handleMouseUp, { capture: true })
      window.removeEventListener('mouseup', handleMouseUp, { capture: true })
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, resizeDirection, position, type])
  
  // Save calculator size to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`calculator-size-${type}`, JSON.stringify(calculatorSize))
    }
  }, [calculatorSize, type])

  // Reset size when type changes
  useEffect(() => {
    setCalculatorSize({
      width: type === 'GRAPHING' ? 900 : 400,
      height: type === 'GRAPHING' ? 650 : 500,
    })
  }, [type])

  // Center calculator on screen when first opened
  useEffect(() => {
    if (!open) {
      // Reset initialization flag when closed so it centers again next time
      hasInitializedRef.current = false
      setIsPositioned(false)
      return
    }
    
    // Immediately set to centered position to avoid showing old position
    setPosition(getCenteredPosition())
    setIsPositioned(false)
    
    // Only center on first open in this session
    if (hasInitializedRef.current) {
      setIsPositioned(true)
      return
    }
    
    // Center calculator on screen - use actual element dimensions if available
    const centerCalculator = () => {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      
      // Try to get actual element dimensions, fallback to estimated
      let elementWidth = calculatorSize.width
      let elementHeight = calculatorSize.height
      
      if (calculatorRef.current) {
        const rect = calculatorRef.current.getBoundingClientRect()
        if (rect.width > 0) elementWidth = rect.width
        if (rect.height > 0) elementHeight = rect.height
      }
      
      // Calculate centered position
      const centeredX = (viewportWidth - elementWidth) / 2
      const centeredY = (viewportHeight - elementHeight) / 2
      
      // Ensure position is valid (not negative)
      setPosition({ 
        x: Math.max(0, Math.round(centeredX)), 
        y: Math.max(0, Math.round(centeredY)) 
      })
      hasInitializedRef.current = true
      setIsPositioned(true)
    }
    
    // Refine position once element is rendered with actual dimensions
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(centerCalculator)
      })
    }, 50)
    
    return () => clearTimeout(timeoutId)
  }, [open, type])

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`calculator-position-${type}`, JSON.stringify(position))
  }, [position, type])

  // Drag handlers - use refs to track state to avoid closure issues
  const dragOffsetRef = useRef<Position | null>(null)
  const isDraggingRef = useRef(false)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent dragging if clicking on buttons or resize handles
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[class*="resize"]')) return
    
    // Don't start dragging if we're resizing
    if (isResizing) return
    
    e.preventDefault()
    e.stopPropagation()
    
    if (calculatorRef.current) {
      // Calculate offset using the position state (which controls the element's CSS position)
      // This ensures the offset matches exactly with how the element is positioned
      dragOffsetRef.current = {
        x: e.clientX - position.x, // offsetX: distance from click to element's left edge
        y: e.clientY - position.y  // offsetY: distance from click to element's top edge
      }
      
      isDraggingRef.current = true
      setIsDragging(true)
    }
  }

  useEffect(() => {
    // Add global style to prevent text selection during dragging
    if (isDragging) {
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.userSelect = ''
    }

    if (!isDragging) {
      isDraggingRef.current = false
      return
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      // Use ref for checking dragging state to avoid closure issues
      if (!isDraggingRef.current || !dragOffsetRef.current || !calculatorRef.current) {
        return
      }
      
      e.preventDefault() // Prevent text selection and other default behaviors
      e.stopPropagation()
      
      // Calculate new position: current mouse position minus the offset
      // dragOffsetRef contains the offset from click point to element's top-left
      let newX = e.clientX - dragOffsetRef.current.x
      let newY = e.clientY - dragOffsetRef.current.y
      
      // Get element dimensions using getBoundingClientRect for accurate measurements
      const rect = calculatorRef.current.getBoundingClientRect()
      const elementWidth = rect.width
      const elementHeight = rect.height
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      
      // Calculate maximum positions where element's right/bottom edge touches viewport edge
      // Allow full movement across the entire viewport from 0 (left) to maxX (right)
      const maxX = Math.max(0, viewportWidth - elementWidth)
      const maxY = Math.max(0, viewportHeight - elementHeight)
      
      // Ensure calculator can reach exactly x=0 (left edge)
      // If mouse is very close to left edge or calculated position is <= 0, allow x=0
      if (e.clientX <= dragOffsetRef.current.x || newX <= 0) {
        newX = 0
      } else if (newX > maxX) {
        newX = maxX
      }
      
      // Ensure calculator can reach exactly y=0 (top edge)
      if (e.clientY <= dragOffsetRef.current.y || newY <= 0) {
        newY = 0
      } else if (newY > maxY) {
        newY = maxY
      }
      
      // Update position - allow exactly 0
      setPosition({ 
        x: newX,
        y: newY
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Only end dragging if we were actually dragging
      if (isDraggingRef.current) {
        e.preventDefault()
        e.stopPropagation()
        isDraggingRef.current = false
        setIsDragging(false)
        dragOffsetRef.current = null
        // Restore user selection
        document.body.style.userSelect = ''
      }
    }

    // Use capture phase and add events to document for reliable tracking even outside element
    document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true })
    document.addEventListener('mouseup', handleMouseUp, { passive: false, capture: true })
    // Also listen on window for mouseup in case mouse leaves document
    window.addEventListener('mouseup', handleMouseUp, { passive: false, capture: true })

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true })
      document.removeEventListener('mouseup', handleMouseUp, { capture: true })
      window.removeEventListener('mouseup', handleMouseUp, { capture: true })
      // Cleanup: restore user selection if component unmounts while dragging
      if (isDraggingRef.current) {
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging])

  // Load Desmos API script for graphing calculator (only once)
  useEffect(() => {
    if (type === 'GRAPHING') {
      setDesmosLoadStartTime(Date.now())
      setShowScientificFallback(false)
      
      // Check if Desmos is already loaded
      if (window.Desmos) {
        setDesmosLoaded(true)
        setDesmosLoadStartTime(null)
        return
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector(`script[src*="desmos.com/api"]`)
      if (existingScript) {
        // Script exists, wait for it to load with timeout
        const startTime = Date.now()
        // Check immediately first
        if (window.Desmos) {
          setDesmosLoaded(true)
          setDesmosLoadStartTime(null)
          return
        }
        
        // Then check periodically with longer interval (200ms instead of 100ms for better performance)
        let fallbackShown = false
        const checkDesmos = setInterval(() => {
          if (window.Desmos) {
            setDesmosLoaded(true)
            setDesmosLoadStartTime(null)
            setShowScientificFallback(false) // Clear fallback when Desmos loads
            clearInterval(checkDesmos)
          } else if (!fallbackShown && Date.now() - startTime > 5000) {
            // 5 second timeout - show fallback option (but continue waiting for Desmos)
            setShowScientificFallback(true)
            fallbackShown = true
            // Don't clear interval - continue checking for Desmos even after showing fallback
          }
        }, 200) // Increased from 100ms to reduce CPU usage
        return () => clearInterval(checkDesmos)
      }

      // Load the script
      if (!DESMOS_API_KEY) {
        console.error('Desmos API key is not configured. Please set NEXT_PUBLIC_DESMOS_API_KEY in your .env.local file.')
        setShowScientificFallback(true)
        return
      }

      const _startTime = Date.now()
      const script = document.createElement('script')
      // Use the latest API version and add cache-busting only if needed
      script.src = `https://www.desmos.com/api/v1.8/calculator.js?apiKey=${DESMOS_API_KEY}`
      script.async = true
      // Don't use defer with async - they conflict. async is better for external scripts
      script.crossOrigin = 'anonymous' // Add CORS for better loading
      script.onload = () => {
        setDesmosLoaded(true)
        setDesmosLoadStartTime(null)
        setShowScientificFallback(false)
      }
      script.onerror = () => {
        console.error('Failed to load Desmos API')
        setShowScientificFallback(true)
        setDesmosLoadStartTime(null)
      }
      
      // Set timeout to show fallback after 5 seconds
      const timeoutId = setTimeout(() => {
        if (!window.Desmos) {
          console.warn('Desmos loading timeout - showing scientific calculator fallback')
          setShowScientificFallback(true)
        }
      }, 5000)
      
      // Append to head for better loading performance
      document.head.appendChild(script)
      
      return () => {
        clearTimeout(timeoutId)
      }
    } else {
      // Cleanup when switching away from graphing calculator type
      if (desmosCalculatorRef.current) {
        try {
          desmosCalculatorRef.current.destroy()
        } catch (error) {
          console.error('Error destroying Desmos calculator:', error)
        }
        desmosCalculatorRef.current = null
      }
      setDesmosLoadStartTime(null)
      setShowScientificFallback(false)
    }
  }, [type])

  // Save Desmos state before closing or minimizing
  useEffect(() => {
    if (type === 'GRAPHING' && desmosCalculatorRef.current) {
      if (!open || isMinimized) {
        // Save state before closing or minimizing
        try {
          const state = desmosCalculatorRef.current.getState()
          savedDesmosStateRef.current = state
        } catch (error) {
          console.error('Error saving Desmos state:', error)
        }
      }
    }
  }, [type, open, isMinimized])

  // Initialize Desmos calculator when container is ready (optimized)
  useEffect(() => {
    if (type === 'GRAPHING' && open && !isMinimized && desmosLoaded) {
      // Optimized: Check immediately first, then use a longer interval if needed
      const initializeDesmos = () => {
        if (desmosContainerRef.current && window.Desmos) {
          // Destroy existing calculator if it exists (for reinitialization)
          if (desmosCalculatorRef.current) {
            try {
              // Save state before destroying
              const state = desmosCalculatorRef.current.getState()
              savedDesmosStateRef.current = state
              desmosCalculatorRef.current.destroy()
            } catch (error) {
              console.error('Error destroying existing Desmos calculator:', error)
            }
            desmosCalculatorRef.current = null
          }

          // Clear container before reinitializing
          if (desmosContainerRef.current) {
            desmosContainerRef.current.innerHTML = ''
          }

          // Initialize immediately - no need for setTimeout if container is ready
          if (desmosContainerRef.current && window.Desmos && !desmosCalculatorRef.current) {
            try {
              desmosCalculatorRef.current = window.Desmos.GraphingCalculator(desmosContainerRef.current, {
                keypad: true,
                expressions: true,
                settingsMenu: true,
                zoomButtons: true,
                expressionsTopbar: true,
                lockViewport: false,
              })
              
                  // Restore saved state if available
                  if (savedDesmosStateRef.current) {
                    try {
                      desmosCalculatorRef.current.setState(savedDesmosStateRef.current)
                    } catch (error) {
                      console.error('Error restoring Desmos state:', error)
                    }
                  }
                  // Mark as initialized to hide loading indicator and switch from scientific calculator
                  setDesmosInitialized(true)
                  setShowScientificFallback(false) // Automatically switch to Desmos when ready
                  return true // Successfully initialized
            } catch (error) {
              console.error('Failed to initialize Desmos calculator:', error)
            }
          }
          return true // Container ready, initialization attempted
        }
        return false // Not ready yet
      }

      // Try immediately first
      if (initializeDesmos()) {
        return // Already initialized or attempted
      }

      // If not ready, check with longer interval (500ms instead of 200ms for much better performance)
      // Most of the time, the container will be ready immediately, so this is just a fallback
      const checkContainer = setInterval(() => {
        if (initializeDesmos()) {
          clearInterval(checkContainer)
        }
      }, 500) // Increased to 500ms to significantly reduce CPU usage

      return () => {
        clearInterval(checkContainer)
      }
    } else if (!open && desmosCalculatorRef.current) {
      // Save state before destroying when dialog closes
      try {
        const state = desmosCalculatorRef.current.getState()
        savedDesmosStateRef.current = state
        desmosCalculatorRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Desmos calculator:', error)
      }
      desmosCalculatorRef.current = null
      setDesmosInitialized(false)
    }
  }, [type, open, isMinimized, desmosLoaded])

  // Reset calculator when type changes
  useEffect(() => {
    clearAll()
    // Destroy Desmos calculator when switching away from graphing
    if (type !== 'GRAPHING' && desmosCalculatorRef.current) {
      try {
        desmosCalculatorRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Desmos calculator:', error)
      }
      desmosCalculatorRef.current = null
      setDesmosInitialized(false)
    }
  }, [type])

  // Keyboard input handler for FOUR_FUNCTION and SCIENTIFIC calculators
  useEffect(() => {
    if (type === 'GRAPHING' || !open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const key = e.key

      // Numbers
      if (/^[0-9]$/.test(key)) {
        e.preventDefault()
        appendNumber(key)
        return
      }

      // Decimal point
      if (key === '.' || key === ',') {
        e.preventDefault()
        appendNumber('.')
        return
      }

      // Operations
      if (key === '+') {
        e.preventDefault()
        handleOperation('+')
        return
      }
      if (key === '-') {
        e.preventDefault()
        handleOperation('-')
        return
      }
      if (key === '*') {
        e.preventDefault()
        handleOperation('×')
        return
      }
      if (key === '/') {
        e.preventDefault()
        handleOperation('÷')
        return
      }
      if (key === '^') {
        e.preventDefault()
        if (type === 'SCIENTIFIC') {
          handleOperation('xʸ')
        }
        return
      }

      // Equals
      if (key === 'Enter' || key === '=') {
        e.preventDefault()
        equals()
        return
      }

      // Clear
      if (key === 'Escape' || key === 'c' || key === 'C') {
        e.preventDefault()
        clearAll()
        return
      }

      // Backspace - delete last character
      if (key === 'Backspace') {
        e.preventDefault()
        if (display.length > 1 && display !== '0') {
          const newDisplay = display.slice(0, -1)
          setDisplay(newDisplay === '' ? '0' : newDisplay)
        } else {
          setDisplay('0')
          setNewNumber(true)
        }
        return
      }

      // Scientific calculator functions (only for SCIENTIFIC type)
      if (type === 'SCIENTIFIC') {
        // Trigonometric functions
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd combinations for scientific functions
          if (key === 's' || key === 'S') {
            e.preventDefault()
            scientificFunction('sin')
            return
          }
          if (key === 'o' || key === 'O') {
            e.preventDefault()
            scientificFunction('cos')
            return
          }
          if (key === 't' || key === 'T') {
            e.preventDefault()
            scientificFunction('tan')
            return
          }
        }

        // Square root
        if (key === 'r' || key === 'R') {
          e.preventDefault()
          scientificFunction('sqrt')
          return
        }

        // Square
        if (key === '²' || (e.shiftKey && key === '2')) {
          e.preventDefault()
          scientificFunction('x²')
          return
        }

        // Pi
        if (key === 'p' || key === 'P') {
          e.preventDefault()
          scientificFunction('π')
          return
        }

        // Euler's number
        if (key === 'e' || key === 'E') {
          e.preventDefault()
          scientificFunction('e')
          return
        }

        // Logarithm
        if (key === 'l' || key === 'L') {
          e.preventDefault()
          scientificFunction('log')
          return
        }

        // Natural logarithm
        if (e.shiftKey && (key === 'l' || key === 'L')) {
          e.preventDefault()
          scientificFunction('ln')
          return
        }

        // Factorial
        if (key === '!' || (e.shiftKey && key === '1')) {
          e.preventDefault()
          scientificFunction('!')
          return
        }

        // Reciprocal (1/x)
        if (key === 'q' || key === 'Q') {
          e.preventDefault()
          scientificFunction('1/x')
          return
        }

        // Absolute value
        if (key === 'a' || key === 'A') {
          e.preventDefault()
          scientificFunction('abs')
          return
        }

        // Angle mode toggle
        if (key === 'm' || key === 'M') {
          e.preventDefault()
          setAngleMode(angleMode === 'DEG' ? 'RAD' : 'DEG')
          return
        }
      }

      // Toggle sign (works for both types)
      if (key === '_' || (e.shiftKey && key === '-')) {
        e.preventDefault()
        toggleSign()
        return
      }

      // Percentage (works for both types)
      if (key === '%' || (e.shiftKey && key === '5')) {
        e.preventDefault()
        percentage()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [type, open, display, newNumber, previousValue, operation, angleMode])

  const formatNumber = (num: number | string): string => {
    if (typeof num === 'string') return num
    if (isNaN(num) || !isFinite(num)) return 'Error'
    
    // Format very large or very small numbers in scientific notation
    if (Math.abs(num) > 1e15 || (Math.abs(num) < 1e-6 && num !== 0)) {
      return num.toExponential(10).replace(/e\+?/, 'e')
    }
    
    // For regular numbers, limit decimal places but keep significant digits
    const str = num.toString()
    if (str.includes('e')) return str
    if (str.length > 15) {
      return num.toPrecision(12)
    }
    return str
  }

  const clear = () => {
    // Standard C behavior: only clear current entry, keep operation and previous value
    setDisplay('0')
    setNewNumber(true)
    // Do NOT clear previousValue or operation - allows continuing the calculation
  }

  const clearAll = () => {
    // AC behavior: clear everything including memory
    setDisplay('0')
    setPreviousValue(null)
    setOperation(null)
    setLastOperation(null)
    setLastOperand(null)
    setNewNumber(true)
    setMemory(0)
  }

  const appendNumber = (num: string) => {
    // If display shows Error, clear it first
    if (display === 'Error') {
      clearAll()
    }
    
    if (newNumber) {
      setDisplay(num === '.' ? '0.' : num)
      setNewNumber(false)
    } else {
      if (num === '.' && display.includes('.')) return
      setDisplay(display + num)
    }
  }

  const handleOperation = (op: string) => {
    const current = parseFloat(display)
    
    if (isNaN(current)) {
      clearAll()
      return
    }
    
    // Clear last operation when starting a new one
    setLastOperation(null)
    setLastOperand(null)
    
    if (previousValue === null) {
      setPreviousValue(current)
    } else if (operation) {
      const result = calculate(previousValue, current, operation)
      if (result === 'Error') {
        setDisplay('Error')
        setPreviousValue(null)
        setOperation(null)
        setNewNumber(true)
        return
      }
      const numResult = typeof result === 'number' ? result : parseFloat(String(result))
      setDisplay(formatNumber(numResult))
      setPreviousValue(numResult)
    }
    
    setOperation(op)
    setNewNumber(true)
  }

  const calculate = (a: number, b: number, op: string): number | string => {
    if (isNaN(a) || isNaN(b)) return 'Error'
    
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '×': return a * b
      case '÷': 
        if (b === 0) return 'Error'
        return a / b
      case '^': 
      case 'xʸ': {
        const result = Math.pow(a, b)
        if (isNaN(result) || !isFinite(result)) return 'Error'
        return result
      }
      default: return b
    }
  }

  const equals = () => {
    // Standard calculator behavior: if there's an active operation, calculate it
    // If no active operation but there's a last operation, repeat it (standard calculator feature)
    if (operation && previousValue !== null) {
      const current = parseFloat(display)
      if (isNaN(current)) {
        clearAll()
        return
      }
      const result = calculate(previousValue, current, operation)
      if (result === 'Error') {
        setDisplay('Error')
        setPreviousValue(null)
        setOperation(null)
        setLastOperation(null)
        setLastOperand(null)
        setNewNumber(true)
        return
      }
      const numResult = typeof result === 'number' ? result : parseFloat(String(result))
      setDisplay(formatNumber(numResult))
      // Store for repeating equals
      setLastOperation(operation)
      setLastOperand(current)
      setPreviousValue(null)
      setOperation(null)
      setNewNumber(true)
    } else if (lastOperation && lastOperand !== null) {
      // Repeat last operation (standard calculator behavior)
      const current = parseFloat(display)
      if (isNaN(current)) {
        clearAll()
        return
      }
      const result = calculate(current, lastOperand, lastOperation)
      if (result === 'Error') {
        setDisplay('Error')
        setLastOperation(null)
        setLastOperand(null)
        setNewNumber(true)
        return
      }
      const numResult = typeof result === 'number' ? result : parseFloat(String(result))
      setDisplay(formatNumber(numResult))
      setNewNumber(true)
    }
  }

  const scientificFunction = (func: string) => {
    const current = parseFloat(display)
    
    if (isNaN(current)) {
      setDisplay('Error')
      setNewNumber(true)
      return
    }
    
    let result: number | string

    switch (func) {
      case 'sin':
        result = angleMode === 'DEG' ? Math.sin(current * Math.PI / 180) : Math.sin(current)
        break
      case 'cos':
        result = angleMode === 'DEG' ? Math.cos(current * Math.PI / 180) : Math.cos(current)
        break
      case 'tan':
        result = angleMode === 'DEG' ? Math.tan(current * Math.PI / 180) : Math.tan(current)
        break
      case 'log':
        if (current <= 0) {
          result = 'Error'
        } else {
          result = Math.log10(current)
        }
        break
      case 'ln':
        if (current <= 0) {
          result = 'Error'
        } else {
          result = Math.log(current)
        }
        break
      case 'sqrt':
        if (current < 0) {
          result = 'Error'
        } else {
          result = Math.sqrt(current)
        }
        break
      case 'x²':
        result = current * current
        break
      case '1/x':
        if (current === 0) {
          result = 'Error'
        } else {
          result = 1 / current
        }
        break
      case 'π':
        result = Math.PI
        setNewNumber(true)
        break
      case 'e':
        result = Math.E
        setNewNumber(true)
        break
      case '!':
        if (current < 0 || current > 170) {
          result = 'Error'
        } else {
          result = factorial(Math.floor(current))
        }
        break
      case 'abs':
        result = Math.abs(current)
        break
      default:
        return
    }

    if (typeof result === 'number' && (isNaN(result) || !isFinite(result))) {
      result = 'Error'
    }

    if (typeof result === 'number') {
      setDisplay(formatNumber(result))
    } else {
      setDisplay(result)
    }
    setNewNumber(true)
  }

  const factorial = (n: number): number => {
    if (n < 0) return 0
    if (n === 0 || n === 1) return 1
    return n * factorial(n - 1)
  }

  const toggleSign = () => {
    if (display === 'Error') {
      clearAll()
      return
    }
    const current = parseFloat(display)
    if (!isNaN(current)) {
      setDisplay(String(-current))
    }
  }

  const percentage = () => {
    if (display === 'Error') {
      clearAll()
      return
    }
    const current = parseFloat(display)
    if (!isNaN(current)) {
      setDisplay(String(current / 100))
    }
  }

  const memoryAdd = () => {
    if (display === 'Error') return
    const current = parseFloat(display)
    if (!isNaN(current)) {
      setMemory(memory + current)
    }
  }

  const memoryRecall = () => {
    setDisplay(String(memory))
    setNewNumber(true)
  }

  const _memoryClear = () => {
    setMemory(0)
  }

  const renderFourFunction = () => (
    <div className="grid grid-cols-4 gap-2">
      <Button variant="outline" onClick={clearAll} className="col-span-2">AC</Button>
      <Button variant="outline" onClick={toggleSign}>+/-</Button>
      <Button variant="outline" onClick={() => handleOperation('÷')}>÷</Button>
      
      <Button variant="outline" onClick={() => appendNumber('7')}>7</Button>
      <Button variant="outline" onClick={() => appendNumber('8')}>8</Button>
      <Button variant="outline" onClick={() => appendNumber('9')}>9</Button>
      <Button variant="outline" onClick={() => handleOperation('×')}>×</Button>
      
      <Button variant="outline" onClick={() => appendNumber('4')}>4</Button>
      <Button variant="outline" onClick={() => appendNumber('5')}>5</Button>
      <Button variant="outline" onClick={() => appendNumber('6')}>6</Button>
      <Button variant="outline" onClick={() => handleOperation('-')}>-</Button>
      
      <Button variant="outline" onClick={() => appendNumber('1')}>1</Button>
      <Button variant="outline" onClick={() => appendNumber('2')}>2</Button>
      <Button variant="outline" onClick={() => appendNumber('3')}>3</Button>
      <Button variant="outline" onClick={() => handleOperation('+')}>+</Button>
      
      <Button variant="outline" onClick={() => appendNumber('0')} className="col-span-2">0</Button>
      <Button variant="outline" onClick={() => appendNumber('.')}>.</Button>
      <Button variant="default" onClick={equals}>=</Button>
    </div>
  )

  const renderScientific = () => (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        <Button
          size="sm"
          variant={angleMode === 'DEG' ? 'default' : 'outline'}
          onClick={() => setAngleMode('DEG')}
          className="flex-1"
        >
          DEG
        </Button>
        <Button
          size="sm"
          variant={angleMode === 'RAD' ? 'default' : 'outline'}
          onClick={() => setAngleMode('RAD')}
          className="flex-1"
        >
          RAD
        </Button>
      </div>
      
      <div className="grid grid-cols-5 gap-1">
        <Button size="sm" variant="outline" onClick={() => scientificFunction('sin')}>sin</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('cos')}>cos</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('tan')}>tan</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('log')}>log</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('ln')}>ln</Button>
        
        <Button size="sm" variant="outline" onClick={() => scientificFunction('x²')}>x²</Button>
        <Button size="sm" variant="outline" onClick={() => handleOperation('xʸ')}>xʸ</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('sqrt')}>√</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('!')}>n!</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('1/x')}>1/x</Button>
        
        <Button size="sm" variant="outline" onClick={() => scientificFunction('π')}>π</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('e')}>e</Button>
        <Button size="sm" variant="outline" onClick={() => scientificFunction('abs')}>|x|</Button>
        <Button size="sm" variant="outline" onClick={memoryAdd}>M+</Button>
        <Button size="sm" variant="outline" onClick={memoryRecall}>MR</Button>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <Button variant="outline" onClick={clearAll}>AC</Button>
        <Button variant="outline" onClick={clear}>C</Button>
        <Button variant="outline" onClick={toggleSign}>+/-</Button>
        <Button variant="outline" onClick={() => handleOperation('÷')}>÷</Button>
        
        <Button variant="outline" onClick={() => appendNumber('7')}>7</Button>
        <Button variant="outline" onClick={() => appendNumber('8')}>8</Button>
        <Button variant="outline" onClick={() => appendNumber('9')}>9</Button>
        <Button variant="outline" onClick={() => handleOperation('×')}>×</Button>
        
        <Button variant="outline" onClick={() => appendNumber('4')}>4</Button>
        <Button variant="outline" onClick={() => appendNumber('5')}>5</Button>
        <Button variant="outline" onClick={() => appendNumber('6')}>6</Button>
        <Button variant="outline" onClick={() => handleOperation('-')}>-</Button>
        
        <Button variant="outline" onClick={() => appendNumber('1')}>1</Button>
        <Button variant="outline" onClick={() => appendNumber('2')}>2</Button>
        <Button variant="outline" onClick={() => appendNumber('3')}>3</Button>
        <Button variant="outline" onClick={() => handleOperation('+')}>+</Button>
        
        <Button variant="outline" onClick={() => appendNumber('0')} className="col-span-2">0</Button>
        <Button variant="outline" onClick={() => appendNumber('.')}>.</Button>
        <Button variant="default" onClick={equals}>=</Button>
      </div>
    </div>
  )



  const renderGraphing = () => {
    const loadingTime = desmosLoadStartTime ? (Date.now() - desmosLoadStartTime) / 1000 : 0
    const isLoading = !desmosLoaded || !desmosInitialized
    
    // If showing fallback, show scientific calculator content
    // Desmos will automatically appear when it finishes loading
    if (showScientificFallback && isLoading) {
      return (
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
            <div className="flex items-start gap-3">
              <CalcIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                  Desmos Calculator Loading
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  Desmos is taking longer than expected ({loadingTime.toFixed(1)}s). Use the scientific calculator below while it continues loading. The graphing calculator will appear automatically when ready.
                </p>
              </div>
            </div>
          </div>
          {/* Show scientific calculator as fallback */}
          {renderScientific()}
        </div>
      )
    }
    
    return (
      <div className="bg-muted rounded-md border relative w-full" style={{ height: `${calculatorSize.height - 100}px`, minHeight: '400px' }}>
        <div 
          key={open ? 'desmos-open' : 'desmos-closed'}
          ref={desmosContainerRef}
          className="w-full h-full"
          style={{ minHeight: '400px', width: '100%' }}
        />
        {isLoading && !showScientificFallback && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10 bg-background/95">
            <div className="text-center space-y-4 bg-background rounded-lg p-6 border shadow-lg max-w-md">
              <CalcIcon className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
              <div>
                <p className="text-sm font-medium mb-2">
                  Loading Desmos calculator...
                </p>
                {loadingTime > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {loadingTime.toFixed(1)}s elapsed
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const getCalculatorTitle = () => {
    switch (type) {
      case 'FOUR_FUNCTION': return 'Calculator'
      case 'SCIENTIFIC': return 'Scientific Calculator'
      case 'GRAPHING': return 'Graphing Calculator'
    }
  }

  const renderCalculatorContent = () => {
    switch (type) {
      case 'FOUR_FUNCTION': return renderFourFunction()
      case 'SCIENTIFIC': return renderScientific()
      case 'GRAPHING': return renderGraphing()
    }
  }

  // Don't render anything if not open and not minimized
  if (!open && !isMinimized) {
    return null
  }

  // Render calculator content using portal to body to escape parent container constraints
  const calculatorContent = (
    <>
      {/* Minimized floating button */}
      {isMinimized && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => {
              setIsMinimized(false)
            }}
            className="rounded-full w-14 h-14 shadow-lg"
            size="icon"
          >
            <CalcIcon className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Main calculator window */}
      {!isMinimized && (
        <div
          ref={calculatorRef}
          className={`fixed z-50 shadow-2xl ${isDragging ? 'cursor-grabbing select-none shadow-3xl' : ''} ${!isPositioned ? 'opacity-0' : 'opacity-100'}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${calculatorSize.width}px`,
            height: `${calculatorSize.height}px`,
            maxWidth: '90vw',
            maxHeight: '90vh',
            transition: (isDragging || isResizing) ? 'none' : isPositioned ? 'opacity 0.2s ease, box-shadow 0.2s ease' : 'none',
            resize: 'none', // Prevent browser default resize
          }}
        >
          <Card className={`border-2 shadow-xl ${isDragging ? 'ring-2 ring-primary/50' : ''}`}>
            <CardHeader 
              className="calculator-drag-handle cursor-grab active:cursor-grabbing pb-3 select-none"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{getCalculatorTitle()}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMinimized(true)
                    }}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenChange(false)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className={`overflow-y-auto`} style={{ height: `calc(${calculatorSize.height}px - 80px)`, maxHeight: 'calc(90vh - 80px)' }}>
              <div className={type === 'GRAPHING' ? '' : 'space-y-4'}>
                {/* Display - only show for non-graphing calculators */}
                {type !== 'GRAPHING' && (
                  <div className="bg-muted rounded-md p-4">
                    <div className="text-right">
                      {operation && previousValue !== null && (
                        <div className="text-sm text-muted-foreground">
                          {previousValue} {operation}
                        </div>
                      )}
                      <div className="text-3xl font-mono font-bold break-all select-none">
                        {display}
                      </div>
                      {memory !== 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Memory: {memory}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Tip: Type numbers and operations on your keyboard
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculator buttons */}
                {renderCalculatorContent()}
              </div>
            </CardContent>
          </Card>
          
          {/* Resize handle - bottom-right corner only for simplicity */}
          {!isMinimized && (
            <div
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 group"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleResizeMouseDown(e, 'se')
              }}
              style={{ 
                cursor: 'se-resize',
                background: 'linear-gradient(to top left, transparent 0%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 100%)'
              }}
              title="Drag to resize"
            />
          )}
        </div>
      )}
    </>
  )

  // Use portal to render calculator directly to body, bypassing parent container constraints
  if (!open && !isMinimized) {
    return null
  }

  // Check if we're in the browser (client-side)
  if (typeof window === 'undefined') {
    return null
  }

  return createPortal(calculatorContent, document.body)
}

// Floating calculator button for test-taking interface
export function CalculatorButton({ 
  calculatorType, 
  className 
}: { 
  calculatorType: CalculatorType
  className?: string 
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className={className}
      >
        <CalcIcon className="h-4 w-4 mr-2" />
        Calculator
      </Button>
      <Calculator type={calculatorType} open={open} onOpenChange={setOpen} />
    </>
  )
}

