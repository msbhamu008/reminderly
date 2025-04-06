"use client"

import { useEffect, useState } from "react"
import { CalendarIcon, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getReminders, sendReminderNow } from "@/app/actions/reminder-actions"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

type Reminder = {
  id: string
  employeeName: string
  employeeId: string
  type: string
  dueDate: string
  daysRemaining: number
  status: "pending" | "sent" | "completed"
}

export function UpcomingReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchReminders = async () => {
      setLoading(true)
      try {
        const response = await getReminders("all", "", "upcoming", 1, 5)

        if (response.success) {
          // Filter to only show upcoming reminders (next 7 days) that are pending
          const upcomingReminders = response.data
            .filter((reminder) => reminder.status === "pending" && reminder.daysRemaining <= 7)
            .sort((a, b) => a.daysRemaining - b.daysRemaining)
            .slice(0, 5)

          setReminders(upcomingReminders)
        } else {
          toast({
            title: "Error",
            description: "Failed to load upcoming reminders",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching reminders:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReminders()
  }, [toast])

  const handleSendReminder = async (id: string) => {
    setSending(id)

    try {
      const response = await sendReminderNow(id)

      if (response.success) {
        setReminders((prev) => prev.filter((reminder) => reminder.id !== id))

        toast({
          title: "Success",
          description: "Reminder sent successfully",
        })
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to send reminder",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setSending(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[160px]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (reminders.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No upcoming reminders in the next 7 days</div>
  }

  return (
    <div className="space-y-4">
      {reminders.map((reminder) => (
        <div key={reminder.id} className="flex items-center justify-between border-b pb-3 last:border-0">
          <div>
            <div className="font-medium">
              <Link href={`/reminders/${reminder.id}`} className="hover:underline">
                {reminder.employeeName}
              </Link>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Badge variant="outline">{reminder.type}</Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CalendarIcon className="h-3 w-3" />
              {new Date(reminder.dueDate).toLocaleDateString()}
              <Clock className="h-3 w-3 ml-2" />
              {reminder.daysRemaining === 0
                ? "Today"
                : reminder.daysRemaining === 1
                  ? "Tomorrow"
                  : `${reminder.daysRemaining} days`}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSendReminder(reminder.id)}
            disabled={sending === reminder.id}
          >
            {sending === reminder.id ? "Sending..." : "Send Now"}
          </Button>
        </div>
      ))}
    </div>
  )
}

