import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@shared/lib/query-client'
import { I18nProvider } from '@shared/components/I18nProvider'
import { TooltipProvider } from '@shared/components/ui/tooltip'
import { Toaster } from '@shared/components/ui/sonner'
import { useTheme } from '@shared/hooks/useTheme'

function ThemeSync() {
  useTheme()
  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider delayDuration={200}>
          <ThemeSync />
          {children}
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
