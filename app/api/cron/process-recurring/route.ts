import { createServerSupabaseClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { addDays, addWeeks, addMonths, addYears } from "date-fns"

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const startTime = Date.now()

    // Enhanced log entry with more details
    const logEntry = {
      job_type: "process_recurring",
      trigger_type: "scheduled",
      status: "started",
      executed_at: new Date().toISOString(),
      details: {
        environment: process.env.NODE_ENV,
        version: "1.0.1", // Track version for debugging
        server_time: new Date().toISOString(),
      },
    }

    // Log the start of the job
    const { data: logData, error: logError } = await supabase.from("cron_job_logs").insert(logEntry).select()

    if (logError) {
      console.error("Error logging cron job start:", logError)
    }

    const logId = logData?.[0]?.id

    // Get all enabled recurring reminders
    const { data: recurringReminders, error: fetchError } = await supabase
      .from("recurring_reminders")
      .select(`
      id,
      name,
      reminder_type_id,
      frequency,
      interval,
      next_due_date,
      enabled
    `)
      .eq("enabled", true)

    if (fetchError) {
      console.error("Error fetching recurring reminders:", fetchError)

      // Update log with error
      if (logId) {
        await supabase
          .from("cron_job_logs")
          .update({
            status: "failed",
            result_data: {
              error: fetchError.message,
              timestamp: new Date().toISOString(),
              execution_time_ms: Date.now() - startTime,
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId)
      }

      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let created = 0
    let updated = 0
    let errors = 0
    const errorDetails: any[] = []
    const processedReminders: any[] = []

    // Process each recurring reminder
    for (const reminder of recurringReminders || []) {
      try {
        const nextDueDate = new Date(reminder.next_due_date)
        nextDueDate.setHours(0, 0, 0, 0)

        // Check if the next due date is today or in the past
        if (nextDueDate <= today) {
          // Create a new employee reminder
          const { data: employees, error: employeesError } = await supabase.from("employees").select("id")

          if (employeesError) {
            console.error("Error fetching employees:", employeesError)
            errors++
            errorDetails.push({
              type: "employee_fetch",
              reminder_id: reminder.id,
              error: employeesError.message,
              timestamp: new Date().toISOString(),
            })
            continue
          }

          // Create reminders for all employees
          for (const employee of employees || []) {
            const { data: reminderData, error: insertError } = await supabase
              .from("employee_reminders")
              .insert({
                employee_id: employee.id,
                reminder_type_id: reminder.reminder_type_id,
                due_date: reminder.next_due_date,
                notes: `Auto-generated from recurring reminder: ${reminder.name}`,
              })
              .select()

            if (insertError) {
              console.error("Error creating employee reminder:", insertError)
              errors++
              errorDetails.push({
                type: "reminder_creation",
                reminder_id: reminder.id,
                employee_id: employee.id,
                error: insertError.message,
                timestamp: new Date().toISOString(),
              })
            } else {
              created++
              processedReminders.push({
                type: "created",
                reminder_id: reminderData?.[0]?.id,
                employee_id: employee.id,
                due_date: reminder.next_due_date,
                timestamp: new Date().toISOString(),
              })
            }
          }

          // Calculate the next due date based on frequency and interval
          let newNextDueDate: Date

          switch (reminder.frequency) {
            case "daily":
              newNextDueDate = addDays(nextDueDate, reminder.interval)
              break
            case "weekly":
              newNextDueDate = addWeeks(nextDueDate, reminder.interval)
              break
            case "monthly":
              if (reminder.reminder_type_id === REMINDER_TYPES.BIRTHDAY || 
                  reminder.reminder_type_id === REMINDER_TYPES.WORK_ANNIVERSARY) {
                // Handle leap year and end of month cases
                const currentYear = new Date().getFullYear();
                const originalDate = new Date(reminder.next_due_date);
                let nextDate = new Date(currentYear, originalDate.getMonth(), originalDate.getDate());
                
                // If it's February 29 and not a leap year, adjust to February 28
                if (originalDate.getMonth() === 1 && originalDate.getDate() === 29 && !isLeapYear(currentYear)) {
                  nextDate = new Date(currentYear, 1, 28);
                }
                
                // If we've passed this year's date, set for next year
                if (nextDate < new Date()) {
                  nextDate.setFullYear(currentYear + 1);
                }
                
                reminder.next_due_date = nextDate;
              } else {
                // Handle other recurring reminders as before
                switch (reminder.frequency.toLowerCase()) {
                  case "daily":
                    newNextDueDate = addDays(nextDueDate, reminder.interval);
                    break;
                  case "weekly":
                    newNextDueDate = addWeeks(nextDueDate, reminder.interval);
                    break;
                  case "monthly":
                    newNextDueDate = addMonths(nextDueDate, reminder.interval);
                    break;
                  case "yearly":
                    newNextDueDate = addYears(nextDueDate, reminder.interval);
                    break;
                  default:
                    newNextDueDate = addMonths(nextDueDate, 1); // Default to monthly
                }
              }
              break
            case "yearly":
              if (reminder.reminder_type_id === REMINDER_TYPES.BIRTHDAY || 
                  reminder.reminder_type_id === REMINDER_TYPES.WORK_ANNIVERSARY) {
                // Special handling for Feb 29 birthdays/anniversaries
                const isLeapYear = (year: number) => {
                  return year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)
                }
                
                const originalMonth = nextDueDate.getMonth()
                const originalDay = nextDueDate.getDate()
                newNextDueDate = addYears(nextDueDate, reminder.interval)
                
                // If it's Feb 29 and next year is not leap year, use Feb 28
                if (originalMonth === 1 && originalDay === 29 && !isLeapYear(newNextDueDate.getFullYear())) {
                  newNextDueDate.setMonth(1)
                  newNextDueDate.setDate(28)
                }
              } else {
                newNextDueDate = addYears(nextDueDate, reminder.interval)
              }
              break
            default:
              newNextDueDate = addMonths(nextDueDate, 1) // Default to monthly
          }

          // Update the recurring reminder with the new next due date
          const { error: updateError } = await supabase
            .from("recurring_reminders")
            .update({
              next_due_date: newNextDueDate.toISOString().split("T")[0],
              last_processed: new Date().toISOString(),
            })
            .eq("id", reminder.id)

          if (updateError) {
            console.error("Error updating recurring reminder:", updateError)
            errors++
            errorDetails.push({
              type: "reminder_update",
              reminder_id: reminder.id,
              error: updateError.message,
              timestamp: new Date().toISOString(),
            })
          } else {
            updated++
            processedReminders.push({
              type: "updated",
              recurring_reminder_id: reminder.id,
              new_due_date: newNextDueDate.toISOString().split("T")[0],
              timestamp: new Date().toISOString(),
            })
          }
        }
      } catch (error) {
        console.error("Error processing recurring reminder:", error)
        errors++
        errorDetails.push({
          type: "processing_error",
          reminder_id: reminder.id,
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const result = {
      success: true,
      stats: {
        processed: recurringReminders?.length || 0,
        created,
        updated,
        errors,
      },
      details: {
        errors: errorDetails,
        processed: processedReminders,
        execution_time_ms: Date.now() - startTime,
      },
    }

    // Update log with result
    if (logId) {
      await supabase
        .from("cron_job_logs")
        .update({
          status: "completed",
          result_data: result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error processing recurring reminders:", error)

    // Log the error
    const supabase = createServerSupabaseClient()
    await supabase
      .from("cron_job_logs")
      .update({
        status: "failed",
        result_data: {
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString(),
        },
        completed_at: new Date().toISOString(),
      })
      .eq("job_type", "process_recurring")
      .is("completed_at", null)

    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

