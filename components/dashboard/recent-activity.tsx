"use client"

import { useEffect, useState } from "react"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { CheckCircle, XCircle } from "lucide-react"

type ActivityLog = {
  id: string
  sent_at: string
  days_before: number
  status: string
  employee_name: string
  reminder_type: string
}

export function RecentActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)

      try {
        const supabase = createClientSupabaseClient()

        // Get recent reminder logs
        const { data, error } = await supabase
          .from("reminder_logs")
          .select(`
            id,
            sent_at,
            days_before,
            status,
            employee_reminder_id,
            employee_reminders (
              employees (
                name
              ),
              reminder_types (
                name
              )
            )
          `)
          .order("sent_at", { ascending: false })
          .limit(5)

        if (error) throw error

        if (data) {
          const formattedLogs = data.map((log) => ({
            id: log.id,
            sent_at: log.sent_at,
            days_before: log.days_before,
            status: log.status,
            employee_name: log.employee_reminders.employees.name,
            reminder_type: log.employee_reminders.reminder_types.name,
          }))

          setLogs(formattedLogs)
        }
      } catch (error) {
        console.error("Error fetching activity logs:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  if (loading) {
    return <div className="text-center py-4">Loading...</div>
  }

  if (logs.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No recent activity</div>
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center justify-between border-b pb-3 last:border-0">
          <div className="flex items-start gap-3">
            {log.status === "sent" ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            )}
            <div>
              <div className="font-medium">
                {log.reminder_type} reminder {log.status === "sent" ? "sent" : "failed"}
              </div>
              <div className="text-sm text-muted-foreground">
                For {log.employee_name} -{log.days_before === 0 ? " on due date" : ` ${log.days_before} days before`}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

