import { processReminders } from "@/lib/email-service-part2"
import { createServerSupabaseClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const startTime = Date.now()
    const supabase = createServerSupabaseClient()

    // Create a log entry
    const { data: logData, error: logError } = await supabase
      .from("cron_job_logs")
      .insert({
        job_type: "process_reminders",
        trigger_type: "scheduled",
        status: "started",
        executed_at: new Date().toISOString(),
      })
      .select()

    if (logError) {
      console.error("Error creating log entry:", logError)
    }

    const logId = logData?.[0]?.id

    // Process the reminders
    const result = await processReminders()
    const executionTime = Date.now() - startTime

    // Update the log entry with the results
    if (logId) {
      await supabase
        .from("cron_job_logs")
        .update({
          status: result.success ? "completed" : "failed",
          result_data: {
            ...result,
            execution_time_ms: executionTime,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId)
    }

    // Return detailed response
    return NextResponse.json({
      success: result.success,
      message: result.message,
      processed: result.processed,
      reminders: result.reminders,
      errors: result.errors,
      execution_time_ms: executionTime
    })

  } catch (error) {
    console.error("Error in process-reminders:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      execution_time_ms: Date.now() - startTime
    }, { status: 500 })
  }
}
