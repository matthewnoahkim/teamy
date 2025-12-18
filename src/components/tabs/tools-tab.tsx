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
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Calculator } from '@/components/tests/calculator'

interface ToolsTabProps {
  clubId: string
  division: 'B' | 'C'
}

// Timer Component
function StudyTimer() {
  const [time, setTime] = useState(50 * 60) // 50 minutes default
  const [isRunning, setIsRunning] = useState(false)
  const [initialTime, setInitialTime] = useState(50 * 60)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [customMinutes, setCustomMinutes] = useState('50')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Try to load audio, but don't fail if it doesn't exist
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio()
        // Use a built-in beep sound approach or try to load audio
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRZT7gHbq3t0c4qb2u7HlkMeCWalyOLBawoFd7HU5qBvEwJRoMzauW4QAGZ+ttvPqGYKDXWt1eGnaQwAW5rQ47RuEABkotHhq2cNAGOe0+KubRABUpnO4bRuDwBgoNTjr2kMAF2e0OK1bxAAZaTV47BqDwBcnNHhtW8RAGek1+Sxaw4AWJzS4rZwEABjotXjsm0OAFqf1OO2cBAAYqPX5LNtDgBZntTjt3ESAGSl2eW0bQ4AWJ7V5LhxEQBkptvmtm4PAFef1+W5cRIAZKjc57dvDwBVntfmunETAGOo3ei4cA8AU57Y57txFABiqN7puHIPAFKf2em7chQAYanf6rlyEABQn9rqvHMVAGGq4Ou6cxEATp/b671zFQBfquLsvHQSAEyg3O2+dBYAXqrj7b11EgBKoNzuv3UXAF2q5O2+dhMAR6Dd7sB2GABbqeXuwHcUAESg3u/BdxkAWanm78F4FgBBn9/vw3oaAFap5/DCeRcAPZ/f8MR6GgBTqOjxw3oYADmf4PHFexsBUKjp8sR7GQA0nuHyx3waAE2n6fPFfBsAL57i88h+GwBJpurzyX4bACue4/TJfhsARKXq9Mp/GwAnneT1yn8cAD+k6vXLgBwAIp3l9syBHQA6o+v2zYEdAB2c5ffNgh4ANaLr982CHgAYnOb4zoMfADCh7PjPhB8AEpvn+M+EHwAroez5z4UgAAya6PnQhiAAJaDs+dGGIAAHmen50YchAB+f7PrSiCEAApnp+tOIIgAZnuz70oksAAya5/vTiisACZjg+9KHLwAKmOH81IktAAaa4vzUii4ABJfg/NWKLwACluD91ootAACU4PzWiS8AAZXS/NWJLwABlcz91IkwAAKVyv3ViTAAAJXI/dWJMQABlcn91okxAAGVyf3ViTEAAJTK/taJMAABlcn91YkxAAGVyf3WiTIAAZTH/NaJMgABlMj91ok0AAGUx/3WiTQAAZTI/daJMwAAlMj91Yk0AAGUyP3ViTQAAJPJ/taJNAABk8n91ok0AACT'
        audioRef.current = audio
      } catch {
        // Silently fail if audio can't be created
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (isRunning && time > 0) {
      intervalRef.current = setInterval(() => {
        setTime(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            if (soundEnabled && audioRef.current) {
              audioRef.current.play().catch(() => {})
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
  }, [isRunning, soundEnabled])

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
    const mins = parseInt(customMinutes)
    if (!isNaN(mins) && mins > 0 && mins <= 180) {
      setPresetTime(mins)
    }
  }

  const progress = (time / initialTime) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Study Timer
        </CardTitle>
        <CardDescription>Track your study sessions with preset or custom times</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Display */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={553}
                strokeDashoffset={553 - (553 * progress) / 100}
                className={`transition-all duration-1000 ${
                  time < 60 ? 'text-red-500' : time < 300 ? 'text-yellow-500' : 'text-primary'
                }`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-mono font-bold ${time < 60 ? 'text-red-500 animate-pulse' : ''}`}>
                {formatTime(time)}
              </span>
              <span className="text-sm text-muted-foreground">
                {isRunning ? 'Running' : time === 0 ? 'Complete!' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            size="lg"
            variant={isRunning ? 'secondary' : 'default'}
            onClick={toggleTimer}
            className="w-24"
          >
            {isRunning ? <Pause className="h-5 w-5 mr-1" /> : <Play className="h-5 w-5 mr-1" />}
            {isRunning ? 'Pause' : 'Start'}
          </Button>
          <Button size="lg" variant="outline" onClick={resetTimer}>
            <RotateCcw className="h-5 w-5 mr-1" />
            Reset
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>

        {/* Presets */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Quick Presets</Label>
          <div className="flex flex-wrap gap-2">
            {[15, 25, 30, 45, 50, 60, 90, 120].map((mins) => (
              <Button
                key={mins}
                variant="outline"
                size="sm"
                onClick={() => setPresetTime(mins)}
                className={initialTime === mins * 60 ? 'border-primary bg-primary/10' : ''}
              >
                {mins} min
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Time */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="custom-time" className="text-sm">Custom Time (minutes)</Label>
            <Input
              id="custom-time"
              type="number"
              min="1"
              max="180"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomTime()}
            />
          </div>
          <Button onClick={handleCustomTime}>Set</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Calculator Selector Component
function CalculatorSelector() {
  const [calculatorType, setCalculatorType] = useState<'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalcIcon className="h-5 w-5" />
          Calculator
        </CardTitle>
        <CardDescription>Choose your calculator type for practice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant={calculatorType === 'FOUR_FUNCTION' ? 'default' : 'outline'}
            className="h-24 flex-col gap-2"
            onClick={() => setCalculatorType('FOUR_FUNCTION')}
          >
            <span className="text-2xl">🧮</span>
            <span className="text-xs">4-Function</span>
          </Button>
          <Button
            variant={calculatorType === 'SCIENTIFIC' ? 'default' : 'outline'}
            className="h-24 flex-col gap-2"
            onClick={() => setCalculatorType('SCIENTIFIC')}
          >
            <span className="text-2xl">📐</span>
            <span className="text-xs">Scientific</span>
          </Button>
          <Button
            variant={calculatorType === 'GRAPHING' ? 'default' : 'outline'}
            className="h-24 flex-col gap-2"
            onClick={() => setCalculatorType('GRAPHING')}
          >
            <span className="text-2xl">📈</span>
            <span className="text-xs">Graphing</span>
          </Button>
        </div>

        {calculatorType && (
          <Calculator
            type={calculatorType}
            open={!!calculatorType}
            onOpenChange={(open) => !open && setCalculatorType(null)}
          />
        )}
      </CardContent>
    </Card>
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
function ResourcesSection({ division }: { division: 'B' | 'C' }) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Study Resources
        </CardTitle>
        <CardDescription>
          Curated resources for Science Olympiad events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Resource List */}
        <ScrollArea className="h-[500px] pr-2">
          <div className="space-y-2">
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
                  <div className="space-y-2">
                    {event.resources.map((resource, idx) => (
                      <a
                        key={idx}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{resource.title}</span>
                          <Badge className={`text-xs ${getTypeColor(resource.type)}`}>
                            {resource.type}
                          </Badge>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function ToolsTab({ clubId, division }: ToolsTabProps) {
  const [activeSection, setActiveSection] = useState<'timer' | 'calculator' | 'resources'>('timer')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Study Tools</h2>
          <p className="text-muted-foreground">
            Timer, calculator, and curated resources for Science Olympiad
          </p>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="timer" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timer</span>
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <CalcIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calculator</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Resources</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="timer" className="mt-0">
            <div className="max-w-lg mx-auto">
              <StudyTimer />
            </div>
          </TabsContent>

          <TabsContent value="calculator" className="mt-0">
            <div className="max-w-lg mx-auto">
              <CalculatorSelector />
            </div>
          </TabsContent>

          <TabsContent value="resources" className="mt-0">
            <ResourcesSection division={division} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default ToolsTab

