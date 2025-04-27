import { EmailData, EmailRecipient, ReminderInterval, ReminderType, Employee, DatabaseReminder } from "./email-service-part1"
import { createServerSupabaseClient } from "./supabase"

// Helper function to get next occurrence of a date (month and day) relative to today
function getNextOccurrenceDate(dateString: string, today: Date): Date {
  const date = new Date(dateString)
  const year = today.getFullYear()
  const nextDate = new Date(year, date.getMonth(), date.getDate())
  if (nextDate < today) {
    nextDate.setFullYear(year + 1)
  }
  return nextDate
}

export async function sendEmail(emailData: EmailData) {
  try {
    if (!emailData.to.length) {
      return { success: false, error: "No recipients specified" }
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY || ""
    const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

    if (!BREVO_API_KEY) {
      console.error("Missing Brevo API key")
      return { success: false, error: "Email service is not properly configured" }
    }

    const fromEmail = process.env.EMAIL_FROM || "noreply@example.com"
    const fromName = process.env.EMAIL_FROM_NAME || "Employee Reminder System"

    // Prepare the request payload for Brevo
    const payload = {
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: emailData.to,
      subject: emailData.subject,
      htmlContent: emailData.html,
    }

    // Send the email using Brevo API
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
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

    // Log the email if logData is provided
    if (emailData.logData && emailData.logData.employeeReminderId) {
      const supabase = createServerSupabaseClient()
      await supabase.from("reminder_logs").insert({
        employee_reminder_id: emailData.logData.employeeReminderId,
        days_before: emailData.logData.daysRemaining,
        recipients: emailData.to.map((r: EmailRecipient) => r.email),
        status: "sent",
        sent_at: new Date().toISOString(),
        message_id: result.messageId,
        reminder_type: emailData.logData.reminderType,
      })
    }

    return {
      success: true,
      messageId: result.messageId || "Email sent successfully",
    }
  } catch (error) {
    console.error("Error sending email:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

// Helper function to replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  if (!template) return ''
  
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{${key}}`, 'g')
    result = result.replace(regex, value || `{${key}}`)  // Keep the placeholder if value is empty
  }
  return result
}

export async function processReminders() {
  const supabase = createServerSupabaseClient()
  const totalProcessed = { sent: 0, failed: 0, skipped: 0 }
  const errors: string[] = []
  const processedReminders: Array<{
    id: string;
    status: "sent" | "failed" | "skipped";
    reason?: string;
    error?: string;
    recipients?: number;
    timestamp: string;
  }> = []

  try {
    // Get all pending reminders with their intervals and completion status
    const { data: reminders, error: remindersError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        reminder_type_id,
        employees (
          id,
          name,
          email,
          manager_email,
          hr_email
        ),
        reminder_types (
          id,
          name,
          email_templates (
            subject_template,
            body_template
          ),
          recipients (
            notify_employee,
            notify_manager,
            notify_hr,
            additional_emails
          ),
          reminder_intervals (
            days_before
          )
        ),
        reminder_logs!left (
          completed_at
        )
      `)
      .is("reminder_logs.completed_at", null) // Only get reminders that haven't been completed
      .order("due_date")

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError)
      return { success: false, error: remindersError.message, processed: totalProcessed, reminders: processedReminders, errors }
    }

    if (!reminders || reminders.length === 0) {
      return {
        success: true,
        message: "No pending reminders found",
        processed: totalProcessed,
        reminders: [],
        errors: []
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Process each reminder
    for (const reminderData of reminders) {
      const reminder: DatabaseReminder = {
        id: reminderData.id,
        due_date: reminderData.due_date,
        reminder_type_id: reminderData.reminder_type_id,
        employees: reminderData.employees as unknown as Employee,
        reminder_types: reminderData.reminder_types as unknown as ReminderType
      }

      const reminderType = reminder.reminder_types
      const intervals = reminderType.reminder_intervals || []
      const emailTemplate = reminderType.email_templates?.[0]
      const recipientsConfig = reminderType.recipients?.[0]

      if (!emailTemplate || !recipientsConfig) {
        errors.push(`Missing template or recipients config for reminder ${reminder.id}`)
        totalProcessed.failed++
        processedReminders.push({
          id: reminder.id,
          status: "failed",
          reason: "Missing template or recipients config",
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Calculate days until due based on reminder type
      let daysUntilDue: number
      if (reminderType.name.toLowerCase().includes("birthday")) {
        // For birthday reminders, use the due_date as the next birthday
        const dueDate = new Date(reminder.due_date)
        dueDate.setHours(0, 0, 0, 0)
        daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      } else if (reminderType.name.toLowerCase().includes("work anniversary") || reminderType.name.toLowerCase().includes("anniversary")) {
        // For work anniversary reminders, use the due_date as the next anniversary
        const dueDate = new Date(reminder.due_date)
        dueDate.setHours(0, 0, 0, 0)
        daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      } else {
        const dueDate = new Date(reminder.due_date)
        dueDate.setHours(0, 0, 0, 0)
        daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Check if we should send a reminder today based on intervals
      const shouldSendToday = intervals.some((interval: ReminderInterval) => interval.days_before === daysUntilDue)

      if (!shouldSendToday) {
        totalProcessed.skipped++
        processedReminders.push({
          id: reminder.id,
          status: "skipped",
          reason: `No matching interval for daysUntilDue: ${daysUntilDue}`,
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Get the due date for recurring reminders (birthday/anniversary)
      let effectiveDueDate = new Date(reminder.due_date)
      // For birthday or anniversary, just use due_date as set in the reminder

      // Check each interval
      for (const interval of intervals) {
        const daysBeforeReminder = interval.days_before
        const reminderDate = new Date(effectiveDueDate)
        reminderDate.setDate(reminderDate.getDate() - daysBeforeReminder)
        reminderDate.setHours(0, 0, 0, 0)

        // If today is not the day to send this reminder, skip it
        if (today.getTime() !== reminderDate.getTime()) {
          continue
        }

        // Prepare recipients list
        const recipients: EmailRecipient[] = []
        const employee = reminder.employees

        if (recipientsConfig.notify_employee && employee.email) {
          recipients.push({ email: employee.email, name: employee.name, role: 'employee' })
        }

        if (recipientsConfig.notify_manager && employee.manager_email) {
          recipients.push({ email: employee.manager_email, role: 'manager' })
        }

        if (recipientsConfig.notify_hr && employee.hr_email) {
          recipients.push({ email: employee.hr_email, role: 'hr' })
        }

        if (recipientsConfig.additional_emails) {
          recipientsConfig.additional_emails.forEach(email => {
            recipients.push({ email, role: 'additional' })
          })
        }

        if (recipients.length === 0) {
          totalProcessed.skipped++
          processedReminders.push({
            id: reminder.id,
            status: 'skipped',
            reason: 'No valid recipients',
            timestamp: new Date().toISOString()
          })
          continue
        }

        // Replace template variables with proper handling
        const variables = {
          employeeName: employee.name || 'Employee',
          employee: employee.name || 'Employee', // Add both variations for flexibility
          type: reminderType.name || 'Reminder',
          dueDate: effectiveDueDate.toLocaleDateString(),
          date: effectiveDueDate.toLocaleDateString(),
          days: daysBeforeReminder === 0 ? "today" : `in ${daysBeforeReminder} days`,
          daysRemaining: daysBeforeReminder.toString(),
          recipient: "HR Manager" // Default recipient title
        }

        const subject = replaceTemplateVariables(emailTemplate.subject_template, variables)
        const html = replaceTemplateVariables(emailTemplate.body_template, variables)

        // Send the email
        const emailResult = await sendEmail({
          to: recipients,
          subject,
          html,
          logData: {
            employeeReminderId: reminder.id,
            reminderType: reminderType.name,
            daysRemaining: daysBeforeReminder
          }
        })

        if (emailResult.success) {
          totalProcessed.sent++
          processedReminders.push({
            id: reminder.id,
            status: 'sent',
            recipients: recipients.length,
            timestamp: new Date().toISOString()
          })
        } else {
          totalProcessed.failed++
          errors.push(`Failed to send reminder ${reminder.id}: ${emailResult.error}`)
          processedReminders.push({
            id: reminder.id,
            status: 'failed',
            error: emailResult.error,
            timestamp: new Date().toISOString()
          })
        }
      }
    }

    return {
      success: true,
      message: "Reminders processed successfully",
      processed: totalProcessed,
      reminders: processedReminders,
      errors: errors.length > 0 ? errors : undefined
    }

  } catch (error) {
    console.error('Error processing reminders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred while processing reminders',
      processed: totalProcessed,
      reminders: processedReminders,
      errors
    }
  }
}
