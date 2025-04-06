import { createServerSupabaseClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()

    // Get reminder logs
    const { data: logs, error } = await supabase
      .from("reminder_logs")
      .select("*")
      .eq("employee_reminder_id", params.id)
      .order("sent_at", { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Get completion log if exists
    const { data: completionLog, error: completionError } = await supabase
      .from("reminder_completions")
      .select("*")
      .eq("employee_reminder_id", params.id)
      .single()

    const allLogs = logs.map((log) => ({
      id: log.id,
      status: log.status,
      recipients: log.recipients,
      timestamp: log.sent_at,
    }))

    // Add completion log if exists
    if (completionLog && !completionError) {
      allLogs.push({
        id: `completion-${completionLog.id}`,
        status: "completed",
        recipients: null,
        timestamp: completionLog.completed_at,
      })
    }

    // Sort by timestamp
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ success: true, logs: allLogs })
  } catch (error) {
    console.error("Error fetching reminder logs:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch reminder logs" }, { status: 500 })
  }
}

