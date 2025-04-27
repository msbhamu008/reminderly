"use client"

import type React from "react"

import { createContext, useContext, useState } from "react"
import { SearchDialog } from "@/components/search-dialog"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"

type SearchContextType = {
  openSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openSearch = () => {
    setOpen(true)
  }

  return (
    <SearchContext.Provider value={{ openSearch }}>
      <SearchDialog open={open} onOpenChange={setOpen} />
      <KeyboardShortcuts onSearchOpen={openSearch} />
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider")
  }
  return context
}

