"use server"

import { createServerSupabaseClient } from "./supabase"

// Configure Brevo API
const BREVO_API_KEY = process.env.BREVO_API_KEY || ""
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

export type EmailData = {
  to: string[]
  subject: string
  html: string
}

export async function sendEmail(emailData: EmailData) {
  try {
    if (!emailData.to.length) {
      return { success: false, error: "No recipients specified" }
    }

    if (!BREVO_API_KEY) {
      console.error("Missing Brevo API key")
      return { success: false, error: "Email service is not properly configured" }
    }

    const fromEmail = process.env.EMAIL_FROM || "noreply@example.com"
    const fromName = process.env.EMAIL_FROM_NAME || "Employee Reminder System"

    // Format recipients for Brevo API
    const recipients = emailData.to.map((email) => ({ email }))

    // Prepare the request payload for Brevo
    const payload = {
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: recipients,
      subject: emailData.subject,
      htmlContent: emailData.html,
    }

    // Send the email using Brevo API
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }

      console.error("Brevo API error:", errorData)
      return {
        success: false,
        error: errorData.message || `Failed to send email through Brevo API: ${response.status} ${response.statusText}`,
        details: errorData,
      }
    }

    const result = await response.json()

    return {
      success: true,
      messageId: result.messageId || "Email sent successfully",
    }
  } catch (error) {
    console.error("Error sending email:", error)
    return {
      success: false,
      error: (error as Error).message,
      details: "Error occurred while sending email through Brevo API",
    }
  }
}

// Helper function to replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, "g"), value || "")
  }
  return result
}

// Improved processReminders function with better error handling and logging
export async function processReminders() {
  try {
    const supabase = createServerSupabaseClient()
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0] // Format as YYYY-MM-DD

    // Get all reminder types and their intervals
    const { data: reminderTypes, error: typesError } = await supabase
      .from("reminder_types")
      .select(`
      id,
      name,
      enabled,
      reminder_intervals (
        days_before
      ),
      email_templates (
        subject_template,
        body_template
      ),
      recipients (
        notify_employee,
        notify_manager,
        notify_hr,
        additional_emails
      )
    `)
      .eq("enabled", true)

    if (typesError) {
      console.error("Error fetching reminder types:", typesError)
      return { success: false, error: typesError.message }
    }

    if (!reminderTypes || reminderTypes.length === 0) {
      return { success: true, stats: { processed: 0, sent: 0, failed: 0 }, message: "No enabled reminder types found" }
    }

    let totalProcessed = 0
    let totalSent = 0
    let totalFailed = 0
    const errors: string[] = []
    const processedReminders: any[] = []

    // Process each reminder type
    for (const reminderType of reminderTypes) {
      // Get intervals for this reminder type
      const intervals = reminderType.reminder_intervals.map((interval) => interval.days_before)

      if (!intervals || intervals.length === 0) {
        errors.push(`No intervals defined for reminder type ${reminderType.name}`)
        continue
      }

      // For each interval, find reminders that need to be sent
      for (const daysBeforeValue of intervals) {
        const targetDate = new Date()
        targetDate.setDate(today.getDate() + daysBeforeValue)

        const targetDateStr = targetDate.toISOString().split("T")[0] // Format as YYYY-MM-DD

        // Find employee reminders due on the target date
        const { data: dueReminders, error: remindersError } = await supabase
          .from("employee_reminders")
          .select(`
          id,
          due_date,
          employees (
            id,
            name,
            email,
            position,
            department,
            manager_email,
            hr_email
          )
        `)
          .eq("reminder_type_id", reminderType.id)
          .eq("due_date", targetDateStr)

        if (remindersError) {
          console.error(`Error fetching reminders for type ${reminderType.name}:`, remindersError)
          errors.push(`Error fetching reminders for type ${reminderType.name}: ${remindersError.message}`)
          continue
        }

        if (!dueReminders || dueReminders.length === 0) {
          continue // No reminders due for this interval
        }

        // Process each due reminder
        for (const reminder of dueReminders) {
          totalProcessed++

          // Check if this reminder has already been sent for this interval
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("employee_reminder_id", reminder.id)
            .eq("days_before", daysBeforeValue)
            .single()

          if (existingLog) {
            // Already sent this reminder for this interval
            processedReminders.push({
              id: reminder.id,
              status: "skipped",
              reason: "already_sent",
              days_before: daysBeforeValue,
              timestamp: new Date().toISOString(),
            })
            continue
          }

          // Check if reminder is already completed
          const { data: completionData } = await supabase
            .from("reminder_completions")
            .select("id")
            .eq("employee_reminder_id", reminder.id)
            .single()

          if (completionData) {
            // Reminder is already completed, skip it
            processedReminders.push({
              id: reminder.id,
              status: "skipped",
              reason: "already_completed",
              timestamp: new Date().toISOString(),
            })
            continue
          }

          // Get email template
          const emailTemplate = reminderType.email_templates[0]
          if (!emailTemplate) {
            errors.push(`No email template found for reminder type ${reminderType.name}`)
            totalFailed++
            processedReminders.push({
              id: reminder.id,
              status: "failed",
              reason: "no_template",
              timestamp: new Date().toISOString(),
            })
            continue
          }

          // Get recipients configuration
          const recipientsConfig = reminderType.recipients[0]
          if (!recipientsConfig) {
            errors.push(`No recipients configuration found for reminder type ${reminderType.name}`)
            totalFailed++
            processedReminders.push({
              id: reminder.id,
              status: "failed",
              reason: "no_recipients_config",
              timestamp: new Date().toISOString(),
            })
            continue
          }

          // Build list of recipients
          const recipients: string[] = []

          if (recipientsConfig.notify_employee && reminder.employees.email) {
            recipients.push(reminder.employees.email)
          }

          // Add manager email if configured and available
          if (recipientsConfig.notify_manager && reminder.employees.manager_email) {
            recipients.push(reminder.employees.manager_email)
          }

          // Add HR email if configured and available
          if (recipientsConfig.notify_hr && reminder.employees.hr_email) {
            recipients.push(reminder.employees.hr_email)
          }

          // Add additional emails
          if (recipientsConfig.additional_emails && Array.isArray(recipientsConfig.additional_emails)) {
            recipients.push(...recipientsConfig.additional_emails)
          }

          if (recipients.length === 0) {
            errors.push(`No recipients found for reminder ${reminder.id}`)
            totalFailed++
            processedReminders.push({
              id: reminder.id,
              status: "failed",
              reason: "no_recipients",
              timestamp: new Date().toISOString(),
            })
            continue
          }

          // Replace placeholders in templates
          const daysText = daysBeforeValue === 0 ? "today" : `in ${daysBeforeValue} days`
          const formattedDate = new Date(reminder.due_date).toLocaleDateString()

          const templateVariables = {
            type: reminderType.name,
            employee: reminder.employees.name,
            days: daysText,
            date: formattedDate,
            recipient: "Concerned Person", // Generic recipient
          }

          const subject = replaceTemplateVariables(emailTemplate.subject_template, templateVariables)
          const body = replaceTemplateVariables(emailTemplate.body_template, templateVariables)

          // Send email
          const emailResult = await sendEmail({
            to: recipients,
            subject,
            html: body,
          })

          // Log the reminder
          if (emailResult.success) {
            await supabase.from("reminder_logs").insert({
              employee_reminder_id: reminder.id,
              days_before: daysBeforeValue,
              recipients,
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            totalSent++
            processedReminders.push({
              id: reminder.id,
              status: "sent",
              recipients: recipients.length,
              days_before: daysBeforeValue,
              timestamp: new Date().toISOString(),
            })
          } else {
            await supabase.from("reminder_logs").insert({
              employee_reminder_id: reminder.id,
              days_before: daysBeforeValue,
              recipients,
              status: "failed",
              sent_at: new Date().toISOString(),
              error_details: emailResult.error,
            })
            totalFailed++
            errors.push(`Failed to send email for reminder ${reminder.id}: ${emailResult.error}`)
            processedReminders.push({
              id: reminder.id,
              status: "failed",
              reason: "email_send_failed",
              error: emailResult.error,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }
    }

    return {
      success: true,
      stats: {
        processed: totalProcessed,
        sent: totalSent,
        failed: totalFailed,
      },
      errors: errors.length > 0 ? errors : undefined,
      processed: processedReminders,
    }
  } catch (error) {
    console.error("Error processing reminders:", error)
    return {
      success: false,
      error: (error as Error).message,
      stack: (error as Error).stack,
    }
  }
}

