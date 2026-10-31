import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const toneStyles: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
  info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: Tone
  className?: string
}

import { ArrowUpRight } from 'lucide-react'

export function StatCard({ icon: Icon, label, value, hint, tone = 'primary', className }: StatCardProps) {
  return (
    <Card className={cn('gap-0 py-0 overflow-hidden relative group/stat transition-all duration-200', className)}>
      <CardContent className="flex items-center gap-3.5 p-4">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', toneStyles[tone])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 group-hover/stat:text-primary transition-colors" />
          </div>
          <p className="text-xl sm:text-2xl font-bold leading-tight tracking-tight text-foreground truncate mt-0.5">{value}</p>
          {hint && <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ icon: Icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <label className="text-sm font-medium leading-snug text-foreground">{label}</label>
      {children}
    </div>
  )
}

/** Wrapper that gives every staff dashboard the same page padding / width. */
export function StaffPage({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-6 min-w-0">{children}</div>
}
