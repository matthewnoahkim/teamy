'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Timer, 
  Calculator as CalcIcon, 
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  Beaker,
  Atom,
  Bug,
  Globe,
  Mountain,
  Leaf,
  Zap,
  Cpu,
  Code,
  FlaskConical,
  Microscope,
  StopCircle,
  Flag,
  Settings2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calculator } from '@/components/tests/calculator'

interface ToolsTabProps {
  clubId: string
  division: 'B' | 'C'
}

// Ring tone types for Web Audio API
type RingToneType = 'beep' | 'chime' | 'bell' | 'alarm' | 'none'

const RING_TONE_NAMES: Record<RingToneType, string> = {
  beep: 'Simple Beep',
  chime: 'Gentle Chime',
  bell: 'School Bell',
  alarm: 'Alarm Clock',
  none: 'Silent',
}

// Web Audio API sound generator
function playSound(type: RingToneType, volume: number = 0.5) {
  if (type === 'none') return
  
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    
    switch (type) {
      case 'beep': {
        // Simple beep - two short tones
        const playBeep = (startTime: number, freq: number) => {
          const osc = audioContext.createOscillator()
          const gain = audioContext.createGain()
          osc.connect(gain)
          gain.connect(audioContext.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(volume, startTime)
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15)
          osc.start(startTime)
          osc.stop(startTime + 0.15)
        }
        playBeep(audioContext.currentTime, 880)
        playBeep(audioContext.currentTime + 0.2, 880)
        playBeep(audioContext.currentTime + 0.4, 1100)
        break
      }
      case 'chime': {
        // Gentle chime - ascending tones
        const frequencies = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
        frequencies.forEach((freq, i) => {
          const osc = audioContext.createOscillator()
          const gain = audioContext.createGain()
          osc.connect(gain)
          gain.connect(audioContext.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          const startTime = audioContext.currentTime + i * 0.15
          gain.gain.setValueAtTime(volume * 0.6, startTime)
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5)
          osc.start(startTime)
          osc.stop(startTime + 0.5)
        })
        break
      }
      case 'bell': {
        // School bell - ringing sound
        const playRing = (startTime: number) => {
          const osc1 = audioContext.createOscillator()
          const osc2 = audioContext.createOscillator()
          const gain = audioContext.createGain()
          osc1.connect(gain)
          osc2.connect(gain)
          gain.connect(audioContext.destination)
          osc1.frequency.value = 800
          osc2.frequency.value = 1200
          osc1.type = 'sine'
          osc2.type = 'sine'
          gain.gain.setValueAtTime(volume * 0.4, startTime)
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
          osc1.start(startTime)
          osc2.start(startTime)
          osc1.stop(startTime + 0.3)
          osc2.stop(startTime + 0.3)
        }
        for (let i = 0; i < 4; i++) {
          playRing(audioContext.currentTime + i * 0.35)
        }
        break
      }
      case 'alarm': {
        // Alarm clock - alternating high-low tones
        const playAlarm = (startTime: number, freq: number) => {
          const osc = audioContext.createOscillator()
          const gain = audioContext.createGain()
          osc.connect(gain)
          gain.connect(audioContext.destination)
          osc.frequency.value = freq
          osc.type = 'square'
          gain.gain.setValueAtTime(volume * 0.3, startTime)
          gain.gain.setValueAtTime(0, startTime + 0.1)
          osc.start(startTime)
          osc.stop(startTime + 0.1)
        }
        for (let i = 0; i < 6; i++) {
          playAlarm(audioContext.currentTime + i * 0.15, i % 2 === 0 ? 880 : 660)
        }
        break
      }
    }
    
    // Clean up after sounds finish
    setTimeout(() => audioContext.close(), 2000)
  } catch (error) {
    console.error('Audio playback failed:', error)
  }
}

// Tool wrapper with expand button
interface ToolCardProps {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  children: React.ReactNode
  headerExtra?: React.ReactNode
}

function ToolCard({ title, icon, isExpanded, onExpand, onCollapse, children, headerExtra }: ToolCardProps) {
  return (
    <Card className={`h-full flex flex-col ${isExpanded ? 'col-span-full row-span-full' : ''}`}>
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            {headerExtra}
            <Button
              variant="ghost"
              size="sm"
              onClick={isExpanded ? onCollapse : onExpand}
              className="h-8 w-8 p-0"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`flex-1 ${isExpanded ? 'overflow-auto' : ''}`}>
        {children}
      </CardContent>
    </Card>
  )
}

// Compact Timer Component with customizable ringtone
function StudyTimer({ isExpanded, onExpand, onCollapse }: { isExpanded: boolean; onExpand: () => void; onCollapse: () => void }) {
  const [time, setTime] = useState(50 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [initialTime, setInitialTime] = useState(50 * 60)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [customMinutes, setCustomMinutes] = useState('50')
  const [customSeconds, setCustomSeconds] = useState('00')
  const [ringTone, setRingTone] = useState<RingToneType>('beep')
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load saved ringtone preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('timer-ringtone')
      if (saved && saved in RING_TONE_NAMES) {
        setRingTone(saved as RingToneType)
      }
    }
  }, [])

  // Save ringtone preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('timer-ringtone', ringTone)
    }
  }, [ringTone])

  useEffect(() => {
    if (isRunning && time > 0) {
      intervalRef.current = setInterval(() => {
        setTime(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            if (soundEnabled) {
              playSound(ringTone)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, soundEnabled, ringTone])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleTimer = () => setIsRunning(!isRunning)
  const resetTimer = () => {
    setIsRunning(false)
    setTime(initialTime)
  }

  const setPresetTime = (minutes: number) => {
    const seconds = minutes * 60
    setInitialTime(seconds)
    setTime(seconds)
    setIsRunning(false)
  }

  const handleCustomTime = () => {
    const mins = parseInt(customMinutes) || 0
    const secs = parseInt(customSeconds) || 0
    const totalSeconds = mins * 60 + secs
    if (totalSeconds > 0 && totalSeconds <= 10800) { // Max 3 hours
      setInitialTime(totalSeconds)
      setTime(totalSeconds)
      setIsRunning(false)
    }
  }

  const testSound = () => {
    playSound(ringTone)
  }

  const progress = initialTime > 0 ? (time / initialTime) * 100 : 0

  const settingsButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowSettings(!showSettings)}
      className="h-8 w-8 p-0"
    >
      <Settings2 className="h-4 w-4" />
    </Button>
  )

  return (
    <ToolCard
      title="Timer"
      icon={<Timer className="h-5 w-5" />}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCollapse={onCollapse}
      headerExtra={settingsButton}
    >
      <div className={`space-y-4 ${isExpanded ? 'max-w-md mx-auto' : ''}`}>
        {showSettings ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Ring Tone</Label>
              <Select value={ringTone} onValueChange={(v) => setRingTone(v as RingToneType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RING_TONE_NAMES).map(([key, name]) => (
                    <SelectItem key={key} value={key}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={testSound} disabled={ringTone === 'none'} className="w-full">
                <Volume2 className="h-4 w-4 mr-2" />
                Test Sound
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowSettings(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* Timer Display */}
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className={`transform -rotate-90 ${isExpanded ? 'w-48 h-48' : 'w-32 h-32'}`}>
                  <circle
                    cx={isExpanded ? '96' : '64'}
                    cy={isExpanded ? '96' : '64'}
                    r={isExpanded ? '84' : '56'}
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle
                    cx={isExpanded ? '96' : '64'}
                    cy={isExpanded ? '96' : '64'}
                    r={isExpanded ? '84' : '56'}
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={isExpanded ? 528 : 352}
                    strokeDashoffset={(isExpanded ? 528 : 352) - ((isExpanded ? 528 : 352) * progress) / 100}
                    className={`transition-all duration-1000 ${
                      time < 60 ? 'text-red-500' : time < 300 ? 'text-yellow-500' : 'text-primary'
                    }`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`font-mono font-bold ${time < 60 ? 'text-red-500 animate-pulse' : ''} ${isExpanded ? 'text-4xl' : 'text-2xl'}`}>
                    {formatTime(time)}
                  </span>
                  <span className={`text-muted-foreground ${isExpanded ? 'text-sm' : 'text-xs'}`}>
                    {isRunning ? 'Running' : time === 0 ? 'Done!' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant={isRunning ? 'secondary' : 'default'}
                onClick={toggleTimer}
              >
                {isRunning ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isRunning ? 'Pause' : 'Start'}
              </Button>
              <Button size="sm" variant="outline" onClick={resetTimer}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1 justify-center">
              {[15, 25, 30, 45, 50, 60].map((mins) => (
                <Button
                  key={mins}
                  variant="outline"
                  size="sm"
                  onClick={() => setPresetTime(mins)}
                  className={`text-xs h-7 px-2 ${initialTime === mins * 60 ? 'border-primary bg-primary/10' : ''}`}
                >
                  {mins}m
                </Button>
              ))}
            </div>

            {/* Custom Time - Compact layout */}
            <div className="flex items-center gap-1 justify-center flex-wrap">
              <Input
                type="number"
                min="0"
                max="180"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomTime()}
                className="h-7 text-xs w-12 text-center px-1"
                placeholder="mm"
              />
              <span className="text-sm font-bold">:</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={customSeconds}
                onChange={(e) => setCustomSeconds(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomTime()}
                className="h-7 text-xs w-12 text-center px-1"
                placeholder="ss"
              />
              <Button size="sm" onClick={handleCustomTime} className="h-7 text-xs px-2">Set</Button>
            </div>
          </>
        )}
      </div>
    </ToolCard>
  )
}

// Stopwatch Component
function Stopwatch({ isExpanded, onExpand, onCollapse }: { isExpanded: boolean; onExpand: () => void; onCollapse: () => void }) {
  const [time, setTime] = useState(0) // in centiseconds
  const [isRunning, setIsRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(prev => prev + 1)
      }, 10) // Update every 10ms for centiseconds
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning])

  const formatTime = (centiseconds: number) => {
    const mins = Math.floor(centiseconds / 6000)
    const secs = Math.floor((centiseconds % 6000) / 100)
    const cs = centiseconds % 100
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  const toggleStopwatch = () => setIsRunning(!isRunning)
  
  const resetStopwatch = () => {
    setIsRunning(false)
    setTime(0)
    setLaps([])
  }

  const addLap = () => {
    if (isRunning) {
      setLaps(prev => [time, ...prev])
    }
  }

  return (
    <ToolCard
      title="Stopwatch"
      icon={<StopCircle className="h-5 w-5" />}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      <div className={`space-y-4 ${isExpanded ? 'max-w-md mx-auto' : ''}`}>
        {/* Display */}
        <div className="text-center">
          <div className={`font-mono font-bold tracking-tight ${isExpanded ? 'text-6xl' : 'text-4xl'}`}>
            {formatTime(time)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant={isRunning ? 'secondary' : 'default'}
            onClick={toggleStopwatch}
          >
            {isRunning ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {isRunning ? 'Stop' : 'Start'}
          </Button>
          <Button size="sm" variant="outline" onClick={addLap} disabled={!isRunning}>
            <Flag className="h-4 w-4 mr-1" />
            Lap
          </Button>
          <Button size="sm" variant="outline" onClick={resetStopwatch}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Laps */}
        {laps.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Laps</Label>
            <ScrollArea className={isExpanded ? 'h-64' : 'h-24'}>
              <div className="space-y-1">
                {laps.map((lapTime, index) => (
                  <div key={index} className="flex justify-between text-sm px-2 py-1 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Lap {laps.length - index}</span>
                    <span className="font-mono">{formatTime(lapTime)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// Inline Calculator Components
function FourFunctionCalculator({ isExpanded, onExpand, onCollapse }: { isExpanded: boolean; onExpand: () => void; onCollapse: () => void }) {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [newNumber, setNewNumber] = useState(true)

  const appendNumber = (num: string) => {
    if (newNumber) {
      setDisplay(num === '.' ? '0.' : num)
      setNewNumber(false)
    } else {
      if (num === '.' && display.includes('.')) return
      setDisplay(display === '0' && num !== '.' ? num : display + num)
    }
  }

  const handleOperation = (op: string) => {
    const current = parseFloat(display)
    if (previousValue !== null && operation && !newNumber) {
      const result = calculate(previousValue, current, operation)
      setDisplay(String(result))
      setPreviousValue(result)
    } else {
      setPreviousValue(current)
    }
    setOperation(op)
    setNewNumber(true)
  }

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '×': return a * b
      case '÷': return b !== 0 ? a / b : 0
      default: return b
    }
  }

  const equals = () => {
    if (previousValue === null || operation === null) return
    const current = parseFloat(display)
    const result = calculate(previousValue, current, operation)
    setDisplay(String(result))
    setPreviousValue(null)
    setOperation(null)
    setNewNumber(true)
  }

  const clear = () => {
    setDisplay('0')
    setNewNumber(true)
  }

  const clearAll = () => {
    setDisplay('0')
    setPreviousValue(null)
    setOperation(null)
    setNewNumber(true)
  }

  return (
    <ToolCard
      title="4-Function"
      icon={<CalcIcon className="h-5 w-5" />}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      <div className={`space-y-2 ${isExpanded ? 'max-w-sm mx-auto' : ''}`}>
        <div className="bg-muted rounded-md p-3 text-right">
          <span className={`font-mono ${isExpanded ? 'text-4xl' : 'text-2xl'}`}>{display}</span>
        </div>
        <div className={`grid grid-cols-4 ${isExpanded ? 'gap-2' : 'gap-1'}`}>
          <Button variant="outline" size="sm" onClick={clearAll} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>AC</Button>
          <Button variant="outline" size="sm" onClick={clear} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>C</Button>
          <Button variant="outline" size="sm" onClick={() => setDisplay(String(-parseFloat(display)))} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>±</Button>
          <Button variant="outline" size="sm" onClick={() => handleOperation('÷')} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>÷</Button>
          
          {['7', '8', '9'].map(n => (
            <Button key={n} variant="outline" size="sm" onClick={() => appendNumber(n)} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>{n}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handleOperation('×')} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>×</Button>
          
          {['4', '5', '6'].map(n => (
            <Button key={n} variant="outline" size="sm" onClick={() => appendNumber(n)} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>{n}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handleOperation('-')} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>-</Button>
          
          {['1', '2', '3'].map(n => (
            <Button key={n} variant="outline" size="sm" onClick={() => appendNumber(n)} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>{n}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handleOperation('+')} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>+</Button>
          
          <Button variant="outline" size="sm" onClick={() => appendNumber('0')} className={`col-span-2 ${isExpanded ? 'h-12 text-lg' : 'h-9'}`}>0</Button>
          <Button variant="outline" size="sm" onClick={() => appendNumber('.')} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>.</Button>
          <Button variant="default" size="sm" onClick={equals} className={isExpanded ? 'h-12 text-lg' : 'h-9'}>=</Button>
        </div>
      </div>
    </ToolCard>
  )
}

function ScientificCalculator({ isExpanded, onExpand, onCollapse }: { isExpanded: boolean; onExpand: () => void; onCollapse: () => void }) {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [newNumber, setNewNumber] = useState(true)
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD'>('DEG')

  const appendNumber = (num: string) => {
    if (newNumber) {
      setDisplay(num === '.' ? '0.' : num)
      setNewNumber(false)
    } else {
      if (num === '.' && display.includes('.')) return
      setDisplay(display === '0' && num !== '.' ? num : display + num)
    }
  }

  const toRadians = (deg: number) => deg * (Math.PI / 180)

  const handleScientific = (func: string) => {
    const current = parseFloat(display)
    let result: number
    const angle = angleMode === 'DEG' ? toRadians(current) : current

    switch (func) {
      case 'sin': result = Math.sin(angle); break
      case 'cos': result = Math.cos(angle); break
      case 'tan': result = Math.tan(angle); break
      case 'log': result = Math.log10(current); break
      case 'ln': result = Math.log(current); break
      case '√': result = Math.sqrt(current); break
      case 'x²': result = current * current; break
      case 'x³': result = current * current * current; break
      case '1/x': result = 1 / current; break
      case 'π': result = Math.PI; break
      case 'e': result = Math.E; break
      case '|x|': result = Math.abs(current); break
      default: result = current
    }
    setDisplay(String(result))
    setNewNumber(true)
  }

  const handleOperation = (op: string) => {
    const current = parseFloat(display)
    if (previousValue !== null && operation && !newNumber) {
      const result = calculate(previousValue, current, operation)
      setDisplay(String(result))
      setPreviousValue(result)
    } else {
      setPreviousValue(current)
    }
    setOperation(op)
    setNewNumber(true)
  }

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '×': return a * b
      case '÷': return b !== 0 ? a / b : 0
      case '^': return Math.pow(a, b)
      default: return b
    }
  }

  const equals = () => {
    if (previousValue === null || operation === null) return
    const current = parseFloat(display)
    const result = calculate(previousValue, current, operation)
    setDisplay(String(result))
    setPreviousValue(null)
    setOperation(null)
    setNewNumber(true)
  }

  const clearAll = () => {
    setDisplay('0')
    setPreviousValue(null)
    setOperation(null)
    setNewNumber(true)
  }

  return (
    <ToolCard
      title="Scientific"
      icon={<CalcIcon className="h-5 w-5" />}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      <div className={`space-y-2 ${isExpanded ? 'max-w-md mx-auto' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAngleMode(angleMode === 'DEG' ? 'RAD' : 'DEG')}
            className="h-6 text-xs"
          >
            {angleMode}
          </Button>
        </div>
        <div className="bg-muted rounded-md p-2 text-right">
          <span className={`font-mono ${isExpanded ? 'text-3xl' : 'text-xl'}`}>{display}</span>
        </div>
        
        {/* Scientific functions */}
        <div className={`grid grid-cols-5 ${isExpanded ? 'gap-2' : 'gap-1'}`}>
          {['sin', 'cos', 'tan', 'log', 'ln'].map(f => (
            <Button key={f} variant="secondary" size="sm" onClick={() => handleScientific(f)} className={isExpanded ? 'h-10' : 'h-7 text-xs'}>{f}</Button>
          ))}
          {['√', 'x²', 'x³', '^', '1/x'].map(f => (
            <Button key={f} variant="secondary" size="sm" onClick={() => f === '^' ? handleOperation('^') : handleScientific(f)} className={isExpanded ? 'h-10' : 'h-7 text-xs'}>{f}</Button>
          ))}
          {['π', 'e', '|x|', '(', ')'].map(f => (
            <Button key={f} variant="secondary" size="sm" onClick={() => handleScientific(f)} className={isExpanded ? 'h-10' : 'h-7 text-xs'}>{f}</Button>
          ))}
        </div>

        {/* Number pad */}
        <div className={`grid grid-cols-4 ${isExpanded ? 'gap-2' : 'gap-1'}`}>
          <Button variant="outline" size="sm" onClick={clearAll} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>AC</Button>
          <Button variant="outline" size="sm" onClick={() => setDisplay(display.slice(0, -1) || '0')} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>⌫</Button>
          <Button variant="outline" size="sm" onClick={() => setDisplay(String(-parseFloat(display)))} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>±</Button>
          <Button variant="outline" size="sm" onClick={() => handleOperation('÷')} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>÷</Button>
          
          {['7', '8', '9'].map(n => (
            <Button key={n} variant="outline" size="sm" onClick={() => appendNumber(n)} className={isExpanded ? 'h-10' : 'h-8'}>{n}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handleOperation('×')} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>×</Button>
          
          {['4', '5', '6'].map(n => (
            <Button key={n} variant="outline" size="sm" onClick={() => appendNumber(n)} className={isExpanded ? 'h-10' : 'h-8'}>{n}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handleOperation('-')} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>-</Button>
          
          {['1', '2', '3'].map(n => (
            <Button key={n} variant="outline" size="sm" onClick={() => appendNumber(n)} className={isExpanded ? 'h-10' : 'h-8'}>{n}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handleOperation('+')} className={isExpanded ? 'h-10' : 'h-8 text-xs'}>+</Button>
          
          <Button variant="outline" size="sm" onClick={() => appendNumber('0')} className={`col-span-2 ${isExpanded ? 'h-10' : 'h-8'}`}>0</Button>
          <Button variant="outline" size="sm" onClick={() => appendNumber('.')} className={isExpanded ? 'h-10' : 'h-8'}>.</Button>
          <Button variant="default" size="sm" onClick={equals} className={isExpanded ? 'h-10' : 'h-8'}>=</Button>
        </div>
      </div>
    </ToolCard>
  )
}

// Graphing Calculator Button (opens full calculator)
function GraphingCalculatorButton({ isExpanded, onExpand, onCollapse }: { isExpanded: boolean; onExpand: () => void; onCollapse: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ToolCard
        title="Graphing"
        icon={<CalcIcon className="h-5 w-5" />}
        isExpanded={isExpanded}
        onExpand={onExpand}
        onCollapse={onCollapse}
      >
        <div className={`flex flex-col items-center justify-center ${isExpanded ? 'h-96' : 'h-full'}`}>
          <div className="text-center space-y-3">
            <CalcIcon className={`mx-auto text-muted-foreground ${isExpanded ? 'h-20 w-20' : 'h-12 w-12'}`} />
            <p className="text-sm text-muted-foreground">Full-featured graphing calculator</p>
            <Button onClick={() => setOpen(true)}>
              Open Graphing Calculator
            </Button>
          </div>
        </div>
      </ToolCard>
      <Calculator type="GRAPHING" open={open} onOpenChange={setOpen} />
    </>
  )
}

// Resources organized by event
interface Resource {
  title: string
  url: string
  type: 'wiki' | 'textbook' | 'video' | 'practice' | 'misc'
}

interface EventResources {
  name: string
  slug: string
  icon: React.ReactNode
  resources: Resource[]
}

const SCIENCE_OLYMPIAD_RESOURCES: EventResources[] = [
  {
    name: 'Anatomy and Physiology',
    slug: 'anatomy',
    icon: <Microscope className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Anatomy_and_Physiology', type: 'wiki' },
      { title: 'OpenStax A&P', url: 'https://openstax.org/details/books/anatomy-and-physiology-2e', type: 'textbook' },
      { title: 'GetBodySmart', url: 'https://www.getbodysmart.com/', type: 'misc' },
      { title: 'InnerBody', url: 'https://www.innerbody.com/', type: 'misc' },
      { title: 'Crash Course A&P', url: 'https://www.youtube.com/playlist?list=PL8dPuuaLjXtOAKed_MxxWBNaPno5h3Zs8', type: 'video' },
    ],
  },
  {
    name: 'Astronomy',
    slug: 'astronomy',
    icon: <Globe className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Astronomy', type: 'wiki' },
      { title: 'OpenStax Astronomy', url: 'https://openstax.org/details/books/astronomy-2e', type: 'textbook' },
      { title: 'NASA Resources', url: 'https://www.nasa.gov/stem-content/', type: 'misc' },
      { title: 'Chandra X-ray Observatory', url: 'https://chandra.harvard.edu/edu/', type: 'misc' },
    ],
  },
  {
    name: 'Chemistry Lab',
    slug: 'chemistry-lab',
    icon: <Beaker className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Chemistry_Lab', type: 'wiki' },
      { title: 'OpenStax Chemistry', url: 'https://openstax.org/details/books/chemistry-2e', type: 'textbook' },
      { title: 'Khan Academy Chemistry', url: 'https://www.khanacademy.org/science/chemistry', type: 'video' },
      { title: 'PhET Simulations', url: 'https://phet.colorado.edu/en/simulations/filter?subjects=chemistry', type: 'practice' },
      { title: 'Crash Course Chemistry', url: 'https://www.youtube.com/playlist?list=PL8dPuuaLjXtPHzzYuWy6fYEaX9mQQ8oGr', type: 'video' },
    ],
  },
  {
    name: 'Circuit Lab',
    slug: 'circuit-lab',
    icon: <Zap className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Circuit_Lab', type: 'wiki' },
      { title: 'OpenStax Physics Vol 2', url: 'https://openstax.org/details/books/university-physics-volume-2', type: 'textbook' },
      { title: 'PhET Circuit Sims', url: 'https://phet.colorado.edu/en/simulations/filter?subjects=physics&type=html', type: 'practice' },
      { title: 'All of AP Physics C: E&M', url: 'https://www.youtube.com/watch?v=ZE8VWTJ-8ME', type: 'video' },
    ],
  },
  {
    name: 'Codebusters',
    slug: 'codebusters',
    icon: <Code className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Codebusters', type: 'wiki' },
      { title: 'Toebes Codebusters', url: 'https://toebes.com/codebusters/', type: 'practice' },
      { title: 'Cryptogram.org', url: 'https://www.cryptogram.org/', type: 'practice' },
      { title: 'Puzzle Baron', url: 'https://cryptograms.puzzlebaron.com/', type: 'practice' },
    ],
  },
  {
    name: 'Designer Genes',
    slug: 'designer-genes',
    icon: <Atom className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Designer_Genes', type: 'wiki' },
      { title: 'NHGRI Genomics Resources', url: 'https://www.genome.gov/About-Genomics/Educational-Resources', type: 'misc' },
      { title: 'OpenStax Biology', url: 'https://openstax.org/details/books/biology-2e', type: 'textbook' },
    ],
  },
  {
    name: 'Disease Detectives',
    slug: 'disease-detectives',
    icon: <Microscope className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Disease_Detectives', type: 'wiki' },
      { title: 'CDC Resources', url: 'https://www.cdc.gov/csels/dsepd/ss1978/index.html', type: 'misc' },
      { title: 'Outbreak at Watersedge', url: 'https://www.cdc.gov/csels/dsepd/ss1978/lesson1/index.html', type: 'practice' },
    ],
  },
  {
    name: 'Dynamic Planet',
    slug: 'dynamic-planet',
    icon: <Globe className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Dynamic_Planet', type: 'wiki' },
      { title: 'OpenStax Earth Science', url: 'https://openstax.org/subjects/science', type: 'textbook' },
    ],
  },
  {
    name: 'Entomology',
    slug: 'entomology',
    icon: <Bug className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Entomology', type: 'wiki' },
      { title: 'BugGuide', url: 'https://bugguide.net/', type: 'misc' },
    ],
  },
  {
    name: 'Forensics',
    slug: 'forensics',
    icon: <FlaskConical className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Forensics', type: 'wiki' },
      { title: 'Forensic Science Simplified', url: 'https://www.forensicsciencesimplified.org/', type: 'misc' },
    ],
  },
  {
    name: 'Rocks and Minerals',
    slug: 'rocks-and-minerals',
    icon: <Mountain className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Rocks_and_Minerals', type: 'wiki' },
      { title: 'Mindat.org', url: 'https://www.mindat.org/', type: 'misc' },
    ],
  },
  {
    name: 'Water Quality',
    slug: 'water-quality',
    icon: <Leaf className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Wiki', url: 'https://scioly.org/wiki/index.php/Water_Quality', type: 'wiki' },
    ],
  },
  {
    name: 'General Resources',
    slug: 'general',
    icon: <BookOpen className="h-4 w-4" />,
    resources: [
      { title: 'Scioly.org Main Wiki', url: 'https://scioly.org/wiki/', type: 'wiki' },
      { title: 'Khan Academy Science', url: 'https://www.khanacademy.org/science', type: 'video' },
      { title: 'OpenStax Free Textbooks', url: 'https://openstax.org/subjects/science', type: 'textbook' },
      { title: 'CK-12 FlexBooks', url: 'https://www.ck12.org/browse/', type: 'textbook' },
      { title: 'LibreTexts Science', url: 'https://libretexts.org/', type: 'textbook' },
      { title: 'Science Olympiad TV', url: 'https://www.youtube.com/user/ScienceOlympiadTV', type: 'video' },
    ],
  },
]

// Resources Component
function ResourcesSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set(['general']))

  const toggleEvent = (slug: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  const filteredResources = SCIENCE_OLYMPIAD_RESOURCES.filter(event => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      event.name.toLowerCase().includes(query) ||
      event.resources.some(r => r.title.toLowerCase().includes(query))
    )
  })

  const getTypeColor = (type: Resource['type']) => {
    switch (type) {
      case 'wiki': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      case 'textbook': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      case 'video': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      case 'practice': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[600px] pr-2">
        <div className="space-y-1">
          {filteredResources.map((event) => (
            <Collapsible
              key={event.slug}
              open={expandedEvents.has(event.slug)}
              onOpenChange={() => toggleEvent(event.slug)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 px-4"
                >
                  <div className="flex items-center gap-2">
                    {event.icon}
                    <span className="font-medium">{event.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {event.resources.length}
                    </Badge>
                  </div>
                  {expandedEvents.has(event.slug) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-10 pr-4 pb-2">
                <div className="space-y-1">
                  {event.resources.map((resource, idx) => (
                    <a
                      key={idx}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 rounded hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{resource.title}</span>
                        <Badge className={`text-xs ${getTypeColor(resource.type)}`}>
                          {resource.type}
                        </Badge>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

type ExpandedTool = 'timer' | 'stopwatch' | 'fourFunc' | 'scientific' | 'graphing' | null

export function ToolsTab({ clubId, division }: ToolsTabProps) {
  const [activeTab, setActiveTab] = useState<'tools' | 'resources'>('tools')
  const [expandedTool, setExpandedTool] = useState<ExpandedTool>(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Study Tools</h2>
        <p className="text-muted-foreground">
          Timer, stopwatch, calculators, and curated resources
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tools' | 'resources')}>
        <TabsList>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <CalcIcon className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="mt-6">
          {/* Timer, Stopwatch, and Calculators Grid */}
          <div className={`grid gap-4 ${expandedTool ? '' : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
            {(!expandedTool || expandedTool === 'timer') && (
              <StudyTimer
                isExpanded={expandedTool === 'timer'}
                onExpand={() => setExpandedTool('timer')}
                onCollapse={() => setExpandedTool(null)}
              />
            )}
            {(!expandedTool || expandedTool === 'stopwatch') && (
              <Stopwatch
                isExpanded={expandedTool === 'stopwatch'}
                onExpand={() => setExpandedTool('stopwatch')}
                onCollapse={() => setExpandedTool(null)}
              />
            )}
            {(!expandedTool || expandedTool === 'fourFunc') && (
              <FourFunctionCalculator
                isExpanded={expandedTool === 'fourFunc'}
                onExpand={() => setExpandedTool('fourFunc')}
                onCollapse={() => setExpandedTool(null)}
              />
            )}
            {(!expandedTool || expandedTool === 'scientific') && (
              <ScientificCalculator
                isExpanded={expandedTool === 'scientific'}
                onExpand={() => setExpandedTool('scientific')}
                onCollapse={() => setExpandedTool(null)}
              />
            )}
            {(!expandedTool || expandedTool === 'graphing') && (
              <GraphingCalculatorButton
                isExpanded={expandedTool === 'graphing'}
                onExpand={() => setExpandedTool('graphing')}
                onCollapse={() => setExpandedTool(null)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <ResourcesSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ToolsTab
