import { createServerSupabaseClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  try {
    // Get reminder logs
    const { data: reminderLogs, error: logsError } = await supabase
      .from("reminder_logs")
      .select("*")
      .eq("employee_reminder_id", params.id)
      .order("sent_at", { ascending: false })

    if (logsError) {
      console.error("Error fetching reminder logs:", logsError)
      return NextResponse.json(
        { message: "Failed to fetch reminder logs" },
        { status: 500 }
      )
    }

    // Get completion record if it exists
    const { data: completionData } = await supabase
      .from("reminder_logs")
      .select("completed_at")
      .eq("employee_reminder_id", params.id)
      .single()

    // Combine logs
    const allLogs = [
      ...(reminderLogs || []).map((log) => ({
        id: log.id,
        status: log.status,
        timestamp: log.sent_at,
        recipients: log.recipients,
      })),
      ...(completionData
        ? [{
            id: "completion",
            status: "completed",
            timestamp: completionData.completed_at,
            recipients: [],
          }]
        : []),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ success: true, logs: allLogs })
  } catch (error) {
    console.error("Error in logs endpoint:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

