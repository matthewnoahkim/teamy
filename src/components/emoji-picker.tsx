'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Smile, Plus } from 'lucide-react'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  currentReactions?: Array<{
    emoji: string
    count: number
    hasUserReacted: boolean
    reactors: Array<{
      id: string
      displayName: string
      image?: string | null
    }>
  }>
  onReactionToggle?: (emoji: string) => void
  disabled?: boolean
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉']

const ALL_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥',
  '👏', '💯', '✨', '🚀', '💪', '🎯', '👀', '🤔',
  '🙌', '✅', '❌', '⭐', '💡', '🎊', '🏆', '👌'
]
const REACTOR_PREVIEW_LIMIT = 4

// Global state to ensure only one picker is open
let globalOpenPicker: (() => void) | null = null

export function EmojiPicker({ 
  onEmojiSelect, 
  currentReactions = [], 
  onReactionToggle,
  disabled = false 
}: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [showQuickReact, setShowQuickReact] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('top')
  const containerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const closePicker = () => {
    setShowPicker(false)
    setShowQuickReact(false)
    globalOpenPicker = null
  }

  const togglePicker = () => {
    if (showPicker) {
      closePicker()
    } else {
      // Close any other open picker first
      if (globalOpenPicker) {
        globalOpenPicker()
      }
      
      // Determine if we should show above or below
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        const spaceAbove = rect.top
        const spaceBelow = window.innerHeight - rect.bottom
        
        // If not enough space above (need ~250px for picker), show below
        setPopoverPosition(spaceAbove < 250 && spaceBelow > 250 ? 'bottom' : 'top')
      }
      
      setShowPicker(true)
      setShowQuickReact(false)
      globalOpenPicker = closePicker
    }
  }

  // Track hover timeout
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleQuickReactHover = () => {
    if (!showPicker && !disabled) {
      // Clear any pending hide timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      setShowQuickReact(true)
    }
  }

  const handleQuickReactLeave = () => {
    // Small delay before hiding to allow moving between button and emojis
    hoverTimeoutRef.current = setTimeout(() => {
      setShowQuickReact(false)
    }, 150)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // Check if click is outside the container
      if (containerRef.current && !containerRef.current.contains(target)) {
        closePicker()
      }
    }

    if (showPicker) {
      // Add a small delay to prevent immediate closing
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 10)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showPicker])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker()
      }
    }

    if (showPicker) {
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showPicker])

  const handleEmojiClick = (emoji: string) => {
    if (onReactionToggle) {
      onReactionToggle(emoji)
    } else {
      onEmojiSelect(emoji)
    }
    closePicker()
  }

  const handleQuickEmoji = (emoji: string) => {
    if (onReactionToggle) {
      onReactionToggle(emoji)
    } else {
      onEmojiSelect(emoji)
    }
    setShowQuickReact(false)
  }

  const getInitial = (displayName: string) => {
    const trimmed = displayName.trim()
    return (trimmed.charAt(0) || '?').toUpperCase()
  }

  return (
    <div ref={containerRef} className="relative inline-flex gap-1.5 flex-wrap items-center">
      {/* Show existing reactions */}
      <TooltipProvider delayDuration={150}>
        {currentReactions.map((reaction) => (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              <Button
                variant={reaction.hasUserReacted ? "default" : "outline"}
                size="sm"
                onClick={() => onReactionToggle?.(reaction.emoji)}
                disabled={disabled}
                className="h-7 px-2 text-sm font-medium transition-all hover:scale-105"
              >
                <span className="mr-1">{reaction.emoji}</span>
                <span className="text-xs">{reaction.count}</span>
              </Button>
            </TooltipTrigger>
            {reaction.reactors.length > 0 && (
              <TooltipContent side="top" className="w-64 p-2">
                <div className="space-y-1.5">
                  {reaction.reactors.slice(0, REACTOR_PREVIEW_LIMIT).map((reactor) => (
                    <div key={reactor.id} className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={reactor.image || ''} />
                        <AvatarFallback className="text-[10px]">
                          {getInitial(reactor.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate">{reactor.displayName}</span>
                    </div>
                  ))}
                  {reaction.reactors.length > REACTOR_PREVIEW_LIMIT && (
                    <p className="text-[11px] text-muted-foreground">
                      +{reaction.reactors.length - REACTOR_PREVIEW_LIMIT} more reacted
                    </p>
                  )}
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </TooltipProvider>
      
      {/* Add reaction button with hover popup */}
      <div 
        className="relative inline-flex"
        onMouseEnter={handleQuickReactHover}
        onMouseLeave={handleQuickReactLeave}
      >
        <Button
          ref={buttonRef}
          variant="outline"
          size="sm"
          onClick={togglePicker}
          disabled={disabled}
          className="h-7 px-2 hover:bg-accent transition-colors"
          aria-label="Add reaction"
        >
          <Smile className="h-3.5 w-3.5" />
        </Button>

        {/* Quick react on hover - with bridge element */}
        {showQuickReact && !showPicker && (
          <>
            {/* Invisible bridge to prevent hover flickering */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-3 z-50"
              onMouseEnter={handleQuickReactHover}
              onMouseLeave={handleQuickReactLeave}
              style={{ pointerEvents: 'all' }}
            />
            <div 
              className="absolute bottom-full left-0 mb-1 flex gap-1 bg-popover border border-border rounded-lg shadow-lg p-1.5 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150"
              onMouseEnter={handleQuickReactHover}
              onMouseLeave={handleQuickReactLeave}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickEmoji(emoji)}
                  className="flex items-center justify-center h-8 w-8 text-xl hover:bg-accent rounded transition-colors"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <div className="w-px bg-border mx-0.5" />
              <button
                onClick={togglePicker}
                className="flex items-center justify-center h-8 w-8 hover:bg-accent rounded transition-colors"
                aria-label="More reactions"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* Full emoji picker popover */}
      {showPicker && (
        <div 
          ref={pickerRef}
          className={`absolute left-0 bg-popover border border-border rounded-lg shadow-xl p-3 z-50 animate-in fade-in duration-200 ${
            popoverPosition === 'top' 
              ? 'bottom-full mb-2 slide-in-from-bottom-2' 
              : 'top-full mt-2 slide-in-from-top-2'
          }`}
          style={{ minWidth: '240px' }}
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pick a reaction
            </h4>
            <button
              onClick={closePicker}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {ALL_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="flex items-center justify-center h-9 w-9 text-xl hover:bg-accent rounded transition-all hover:scale-110"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
