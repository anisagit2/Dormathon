import type { Metadata, Viewport } from 'next'
import React from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReCap — Study Assistant',
  description: 'Summarize class recordings, build a weekly study plan, and stay on top of class changes and deadlines from Gmail.',
  keywords: ['study planner', 'AI assistant', 'student', 'Gmail', 'meeting notes', 'study alerts'],
  authors: [{ name: 'ReCap' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
