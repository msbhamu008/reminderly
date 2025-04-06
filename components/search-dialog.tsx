"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Calendar, User, Bell } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDebounce } from "@/hooks/use-debounce"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { createClientSupabaseClient } from "@/lib/supabase/client"

type SearchResult = {
  id: string
  type: "employee" | "reminder"
  title: string
  subtitle: string
  dueDate?: string
  status?: string
  url: string
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  // Reset query when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
    }
  }, [open])

  const search = useCallback(async () => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)

    try {
      const supabase = createClientSupabaseClient()

      // Search employees
      const { data: employees } = await supabase
        .from("employees")
        .select("id, name, employee_id, email, position, department")
        .or(
          `name.ilike.%${debouncedQuery}%,employee_id.ilike.%${debouncedQuery}%,email.ilike.%${debouncedQuery}%,position.ilike.%${debouncedQuery}%,department.ilike.%${debouncedQuery}%`,
        )
        .limit(5)

      // Search reminders
      const { data: reminders } = await supabase
        .from("employee_reminders")
        .select(`
          id, 
          due_date,
          employees (name, employee_id),
          reminder_types (name)
        `)
        .or(`employees.name.ilike.%${debouncedQuery}%,reminder_types.name.ilike.%${debouncedQuery}%`)
        .limit(5)

      const searchResults: SearchResult[] = [
        ...(employees?.map((employee) => ({
          id: employee.id,
          type: "employee" as const,
          title: employee.name,
          subtitle: `${employee.position || "Employee"} - ${employee.department || "N/A"}`,
          url: `/employees?search=${encodeURIComponent(employee.name)}`,
        })) || []),
        ...(reminders?.map((reminder) => ({
          id: reminder.id,
          type: "reminder" as const,
          title: `${reminder.employees.name}'s ${reminder.reminder_types.name}`,
          subtitle: `ID: ${reminder.employees.employee_id}`,
          dueDate: reminder.due_date,
          url: `/reminders/${reminder.id}`,
        })) || []),
      ]

      setResults(searchResults)
    } catch (error) {
      console.error("Error searching:", error)
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery])

  useEffect(() => {
    if (open) {
      search()
    }
  }, [search, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search for employees, reminders, and more</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && results.length === 0 && query.length > 1 && (
              <div className="text-center py-4 text-muted-foreground">No results found</div>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-2">
                {results.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.url}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {result.type === "employee" ? (
                          <User className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Bell className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{result.title}</span>
                        <Badge variant="outline">{result.type === "employee" ? "Employee" : "Reminder"}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                    </div>
                    {result.dueDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(result.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

