"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, BarChart, Home, Settings,FileSpreadsheet, Users, Search, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"
import { useSearch } from "@/components/search-provider"

export function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { openSearch } = useSearch()

  // Simplified navigation structure with fewer, more focused options
  const routes = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/reminders",
      label: "Reminders",
      icon: Bell,
      active: pathname.startsWith("/reminders"),
    },
    {
      href: "/employees",
      label: "Employees",
      icon: Users,
      active: pathname === "/employees",
    },
    {
      href: "/upload",
      label: "Upload Data",
      icon: FileSpreadsheet,
      active: false,
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: BarChart,
      active: pathname === "/dashboard",
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      active: pathname.startsWith("/settings"),
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <Bell className="h-6 w-6" />
            <span className="font-bold hidden sm:inline-block">Employee Reminder System</span>
          </Link>
        </div>

        {/* Desktop Navigation - Simplified */}
        <nav className="hidden md:flex items-center space-x-2 lg:space-x-4 mx-6">
          {routes.map((route) => (
            <Button
              key={route.href}
              asChild
              variant={route.active ? "default" : "ghost"}
              className="text-sm font-medium"
              size="sm"
            >
              <Link href={route.href} className="flex items-center">
                <route.icon className="h-4 w-4 mr-2" />
                <span>{route.label}</span>
              </Link>
            </Button>
          ))}
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden ml-auto">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px]">
              <div className="flex items-center justify-between mb-6">
                <Link href="/" className="flex items-center space-x-2" onClick={() => setMobileMenuOpen(false)}>
                  <Bell className="h-6 w-6" />
                  <span className="font-bold">Employee Reminder</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="flex flex-col space-y-4">
                {routes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                      "flex items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      route.active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <route.icon className="h-4 w-4 mr-2" />
                    <span>{route.label}</span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Search and Theme Toggle */}
        <div className="ml-auto flex items-center space-x-4">
          <Button variant="outline" className="hidden md:flex" onClick={openSearch}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search</span>
            <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={openSearch}>
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}

