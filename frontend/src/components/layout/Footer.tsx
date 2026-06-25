import { Github, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/config/brand'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/sessionStore'

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  const [version, setVersion] = useState<string>('')
  const activeSessionCount = useSessionStore((s) => s.activeSessionCount)

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch('/auth/app-info')
        const data = await response.json()
        if (data.status === 'success') {
          setVersion(data.version)
        }
      } catch (_error) {}
    }

    fetchVersion()
  }, [])

  return (
    <footer className={cn('mt-auto border-t bg-muted/30', className)}>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© 2026 {BRAND.name}</span>
            <span className="hidden md:inline">|</span>
            <a
              href={BRAND.url}
              className="text-primary hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {BRAND.domain}
            </a>
          </div>
          <span className="hidden md:inline">|</span>
          <span className="text-center">{BRAND.subTagline}</span>
          <span className="hidden md:inline">|</span>
          {version && (
            <Badge variant="secondary" className="gap-1">
              <span className="opacity-75">v</span>
              <span>{version}</span>
            </Badge>
          )}
          {activeSessionCount > 0 && (
            <>
              <span className="hidden md:inline">|</span>
              <Badge variant="outline" className="gap-1">
                <Monitor className="h-3 w-3" />
                <span>
                  {activeSessionCount} {activeSessionCount === 1 ? 'session' : 'sessions'}
                </span>
              </Badge>
            </>
          )}
        </div>

        {/* Social Links */}
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <a
              href={BRAND.links.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source code (GitHub)"
            >
              <Github className="h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* AGPL-3.0 attribution — required by the upstream license. */}
        <p className="text-center text-xs text-muted-foreground/70 mt-3">
          Built on{' '}
          <a
            href={BRAND.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {BRAND.poweredBy}
          </a>{' '}
          · Licensed under AGPL-3.0
        </p>
      </div>
    </footer>
  )
}
