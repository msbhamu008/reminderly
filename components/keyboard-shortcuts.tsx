"use client"

import { useEffect } from "react"

interface KeyboardShortcutsProps {
  onSearchOpen: () => void
}

export function KeyboardShortcuts({ onSearchOpen }: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onSearchOpen()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onSearchOpen])

  return null
}

