import { createServerSupabaseClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  try {
    // First check if reminder exists
    const { data: reminder, error: reminderError } = await supabase
      .from("employee_reminders")
      .select("id")
      .eq("id", params.id)
      .single()

    if (reminderError || !reminder) {
      return NextResponse.json(
        { message: "Reminder not found" },
        { status: 404 }
      )
    }

    // Check if already completed
    const { data: existingCompletion } = await supabase
      .from("reminder_logs")
      .select("id")
      .eq("employee_reminder_id", params.id)
      .eq("status", "completed")
      .maybeSingle()

    if (existingCompletion) {
      return NextResponse.json(
        { message: "Reminder already marked as complete" },
        { status: 400 }
      )
    }

    // Add completion record
    const { error: completionError } = await supabase
      .from("reminder_logs")
      .insert({
        employee_reminder_id: params.id,
        status: "completed",
        days_before: 0,
        recipients: [],
        sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

    if (completionError) {
      return NextResponse.json(
        { message: "Failed to mark reminder as complete" },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: "Reminder marked as complete" })
  } catch (error) {
    console.error("Error marking reminder as complete:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}