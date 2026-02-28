'use client'

import type React from 'react'

interface LegalSection {
  id: string
  title: string
}

interface LegalDocumentShellProps {
  title: string
  lastUpdated: string
  sections: LegalSection[]
  children: React.ReactNode
}

export function LegalDocumentShell({ title, lastUpdated, sections: _sections, children }: LegalDocumentShellProps) {
  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="mb-6 rounded-2xl border border-border bg-card p-6 md:p-8">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-8 md:p-10 shadow-card">
        {children}
      </div>
    </div>
  )
}
