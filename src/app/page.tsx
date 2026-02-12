import { Mail } from 'lucide-react'
import { Logo } from '@/components/logo'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Site Under Development
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground">
            We're working hard to bring you something amazing!
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 space-y-4">
          <div className="flex items-center justify-center gap-3 text-teamy-primary">
            <Mail className="h-6 w-6" />
            <h2 className="text-2xl font-semibold">Early Tester Access</h2>
          </div>
          
          <p className="text-base text-muted-foreground">
            Want to be among the first to try Teamy? Email us to join our early tester list!
          </p>
          
          <div className="pt-4">
            <a
              href="mailto:teamysite@gmail.com"
              className="inline-flex items-center gap-2 px-6 py-3 bg-teamy-primary text-white rounded-lg font-medium hover:bg-teamy-primary/90 transition-colors"
            >
              <Mail className="h-5 w-5" />
              teamysite@gmail.com
            </a>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Teamy. All rights reserved.
        </p>
      </div>
    </div>
  )
}
