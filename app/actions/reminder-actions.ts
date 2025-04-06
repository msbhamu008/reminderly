"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email-service"

export async function getReminderTypes() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("reminder_types")
    .select(`
      id,
      name,
      enabled,
      reminder_intervals (
        id,
        days_before
      ),
      email_templates (
        id,
        subject_template,
        body_template
      ),
      recipients (
        id,
        notify_employee,
        notify_manager,
        notify_hr,
        additional_emails
      )
    `)
    .order("name")

  if (error) {
    console.error("Error fetching reminder types:", error)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((type) => ({
      id: type.id,
      name: type.name,
      enabled: type.enabled,
      intervals: type.reminder_intervals.map((interval) => interval.days_before).sort((a, b) => b - a),
      emailTemplate: type.email_templates[0] || null,
      recipients: type.recipients[0] || null,
    })),
  }
}

export async function addReminderType(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const name = formData.get("name") as string
  const enabled = formData.get("enabled") === "true"

  // First, add the reminder type
  const { data: typeData, error: typeError } = await supabase.from("reminder_types").insert({ name, enabled }).select()

  if (typeError) {
    console.error("Error adding reminder type:", typeError)
    return { success: false, error: typeError.message }
  }

  const typeId = typeData[0].id

  // Add default interval (30 days)
  const { error: intervalError } = await supabase
    .from("reminder_intervals")
    .insert({ reminder_type_id: typeId, days_before: 30 })

  if (intervalError) {
    console.error("Error adding default interval:", intervalError)
  }

  // Add default email template
  const { error: templateError } = await supabase.from("email_templates").insert({
    reminder_type_id: typeId,
    subject_template: `[${name}] Reminder for {employee} - Due in {days}`,
    body_template: `Dear {recipient},

This is a reminder that {employee}'s ${name} is due on {date} ({days}).

Please take appropriate action before the due date.

Regards,
HR Department`,
  })

  if (templateError) {
    console.error("Error adding default email template:", templateError)
  }

  // Add default recipients configuration
  const { error: recipientsError } = await supabase.from("recipients").insert({
    reminder_type_id: typeId,
    notify_employee: true,
    notify_manager: true,
    notify_hr: true,
    additional_emails: [],
  })

  if (recipientsError) {
    console.error("Error adding default recipients configuration:", recipientsError)
  }

  revalidatePath("/settings")
  return { success: true, data: typeData[0] }
}

export async function updateReminderType(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const name = formData.get("name") as string
  const enabled = formData.get("enabled") === "true"

  const { data, error } = await supabase.from("reminder_types").update({ name, enabled }).eq("id", id).select()

  if (error) {
    console.error("Error updating reminder type:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true, data: data[0] }
}

export async function deleteReminderType(id: string) {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("reminder_types").delete().eq("id", id)

  if (error) {
    console.error("Error deleting reminder type:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function addReminderInterval(typeId: string, daysBeforeValue: number) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("reminder_intervals")
    .insert({ reminder_type_id: typeId, days_before: daysBeforeValue })
    .select()

  if (error) {
    console.error("Error adding reminder interval:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true, data: data[0] }
}

export async function deleteReminderInterval(typeId: string, daysBeforeValue: number) {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("reminder_intervals")
    .delete()
    .eq("reminder_type_id", typeId)
    .eq("days_before", daysBeforeValue)

  if (error) {
    console.error("Error deleting reminder interval:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateEmailTemplate(typeId: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const subjectTemplate = formData.get("subject_template") as string
  const bodyTemplate = formData.get("body_template") as string

  // Check if template exists
  const { data: existingTemplate } = await supabase
    .from("email_templates")
    .select("id")
    .eq("reminder_type_id", typeId)
    .single()

  if (existingTemplate) {
    // Update existing template
    const { error } = await supabase
      .from("email_templates")
      .update({ subject_template: subjectTemplate, body_template: bodyTemplate })
      .eq("id", existingTemplate.id)

    if (error) {
      console.error("Error updating email template:", error)
      return { success: false, error: error.message }
    }
  } else {
    // Create new template
    const { error } = await supabase
      .from("email_templates")
      .insert({ reminder_type_id: typeId, subject_template: subjectTemplate, body_template: bodyTemplate })

    if (error) {
      console.error("Error creating email template:", error)
      return { success: false, error: error.message }
    }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateRecipients(typeId: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const notifyEmployee = formData.get("notify_employee") === "true"
  const notifyManager = formData.get("notify_manager") === "true"
  const notifyHr = formData.get("notify_hr") === "true"

  // Parse additional emails from comma-separated string to array
  const additionalEmailsString = (formData.get("additional_emails") as string) || ""
  const additionalEmails = additionalEmailsString
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0)

  // Check if recipients config exists
  const { data: existingConfig } = await supabase
    .from("recipients")
    .select("id")
    .eq("reminder_type_id", typeId)
    .single()

  if (existingConfig) {
    // Update existing config
    const { error } = await supabase
      .from("recipients")
      .update({
        notify_employee: notifyEmployee,
        notify_manager: notifyManager,
        notify_hr: notifyHr,
        additional_emails: additionalEmails,
      })
      .eq("id", existingConfig.id)

    if (error) {
      console.error("Error updating recipients configuration:", error)
      return { success: false, error: error.message }
    }
  } else {
    // Create new config
    const { error } = await supabase.from("recipients").insert({
      reminder_type_id: typeId,
      notify_employee: notifyEmployee,
      notify_manager: notifyManager,
      notify_hr: notifyHr,
      additional_emails: additionalEmails,
    })

    if (error) {
      console.error("Error creating recipients configuration:", error)
      return { success: false, error: error.message }
    }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function getReminders(filterType = "all", searchQuery = "") {
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from("employee_reminders")
    .select(`
      id,
      due_date,
      employees (
        id,
        employee_id,
        name,
        email,
        manager_email,
        hr_email
      ),
      reminder_types (
        id,
        name
      ),
      reminder_logs (
        id,
        days_before,
        sent_at
      )
    `)
    .order("due_date")

  if (filterType !== "all") {
    // Join with reminder_types to filter by type name
    query = query.eq("reminder_types.name", filterType)
  }

  if (searchQuery) {
    // Filter by employee name or ID
    query = query.or(`employees.name.ilike.%${searchQuery}%,employees.employee_id.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching reminders:", error)
    return { success: false, error: error.message }
  }

  // Calculate days remaining for each reminder
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return {
    success: true,
    data: data.map((reminder) => {
      const dueDate = new Date(reminder.due_date)
      dueDate.setHours(0, 0, 0, 0)

      const diffTime = dueDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Determine status based on reminder logs
      let status = "pending"
      if (reminder.reminder_logs && reminder.reminder_logs.length > 0) {
        // If we have any logs, at least one reminder has been sent
        status = "sent"
      }

      return {
        id: reminder.id,
        employeeName: reminder.employees.name,
        employeeId: reminder.employees.employee_id,
        email: reminder.employees.email,
        hrEmail: reminder.employees.hr_email,
        managerEmail: reminder.employees.manager_email,
        type: reminder.reminder_types.name,
        dueDate: reminder.due_date,
        daysRemaining,
        status,
      }
    }),
  }
}

export async function addEmployeeReminder(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const employeeId = formData.get("employee_id") as string
  const reminderTypeId = formData.get("reminder_type_id") as string
  const dueDate = formData.get("due_date") as string
  const notes = formData.get("notes") as string

  const { data, error } = await supabase
    .from("employee_reminders")
    .insert({
      employee_id: employeeId,
      reminder_type_id: reminderTypeId,
      due_date: dueDate,
      notes,
    })
    .select()

  if (error) {
    console.error("Error adding employee reminder:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/reminders")
  return { success: true, data: data[0] }
}

// Helper function to replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, "g"), value)
  }
  return result
}

// Update the sendReminderNow function to properly use templates
export async function sendReminderNow(reminderId: string) {
  const supabase = createServerSupabaseClient()

  try {
    // Get the reminder details with all necessary email fields
    const { data: reminder, error: reminderError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
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
          )
        )
      `)
      .eq("id", reminderId)
      .single()

    if (reminderError || !reminder) {
      console.error("Error fetching reminder details:", reminderError)
      return { success: false, error: reminderError?.message || "Reminder not found" }
    }

    // Validate required email
    if (!reminder.employees.email) {
      console.error("Employee email missing for reminder:", reminderId)
      return { success: false, error: "Employee email is missing" }
    }

    // Calculate days remaining
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(reminder.due_date)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Get email template
    const emailTemplate = reminder.reminder_types.email_templates[0]
    if (!emailTemplate) {
      return { success: false, error: "No email template found for this reminder type" }
    }

    // Get recipients configuration
    const recipientsConfig = reminder.reminder_types.recipients[0]
    if (!recipientsConfig) {
      return { success: false, error: "No recipients configuration found for this reminder type" }
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
      return { success: false, error: "No recipients found for this reminder" }
    }

    // Replace placeholders in templates
    const daysText = daysRemaining <= 0 ? "today" : `in ${daysRemaining} days`
    const formattedDate = new Date(reminder.due_date).toLocaleDateString()

    const templateVariables = {
      type: reminder.reminder_types.name,
      employee: reminder.employees.name,
      days: daysText,
      date: formattedDate,
      recipient: "Concerned Person", // Generic recipient
    }

    const subject = replaceTemplateVariables(emailTemplate.subject_template, templateVariables)
    const body = replaceTemplateVariables(emailTemplate.body_template, templateVariables)

    // Send the email
    const emailResult = await sendEmail({
      to: recipients,
      subject,
      html: body,
    })

    if (!emailResult.success) {
      return { success: false, error: emailResult.error || "Failed to send email" }
    }

    // Log success and update status
    const { error: logError } = await supabase.from("reminder_logs").insert({
      employee_reminder_id: reminder.id,
      days_before: daysRemaining,
      recipients: [
        reminder.employees.email,
        reminder.employees.manager_email,
        reminder.employees.hr_email
      ].filter(Boolean),
      status: "sent",
      sent_at: new Date().toISOString(),
    })

    if (logError) {
      console.error("Error logging reminder:", logError)
      return { success: false, error: logError.message }
    }

    revalidatePath("/reminders")
    return { success: true }
  } catch (error) {
    console.error("Error in sendReminderNow:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send reminder" 
    }
  }
}

export async function sendBulkReminders(reminderIds: string[]) {
  const supabase = createServerSupabaseClient()

  if (!reminderIds || reminderIds.length === 0) {
    return { success: false, error: "No reminders specified" }
  }

  let sent = 0
  let failed = 0
  const sentIds: string[] = []
  const errors: string[] = []

  // Process each reminder
  for (const reminderId of reminderIds) {
    try {
      const result = await sendReminderNow(reminderId)

      if (result.success) {
        sent++
        sentIds.push(reminderId)
      } else {
        failed++
        errors.push(`Failed to send reminder ${reminderId}: ${result.error}`)
      }
    } catch (error) {
      failed++
      errors.push(`Error processing reminder ${reminderId}: ${(error as Error).message}`)
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
    sentIds,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  }
}

export async function getReminderById(id: string) {
  const supabase = createServerSupabaseClient()

  try {
    // Get the reminder details
    const { data: reminder, error: reminderError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        notes,
        reminder_type_id,
        employees (
          id,
          employee_id,
          name,
          email
        ),
        reminder_types (
          id,
          name
        ),
        reminder_logs (
          id,
          days_before,
          sent_at,
          status
        )
      `)
      .eq("id", id)
      .single()

    if (reminderError) {
      console.error("Error fetching reminder details:", reminderError)
      return { success: false, error: reminderError.message }
    }

    // Check if reminder is completed
    const { data: completionData } = await supabase
      .from("reminder_completions")
      .select("completed_at")
      .eq("employee_reminder_id", id)
      .single()

    // Calculate days remaining
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(reminder.due_date)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Determine status
    let status = "pending"
    if (completionData) {
      status = "completed"
    } else if (reminder.reminder_logs && reminder.reminder_logs.length > 0) {
      status = "sent"
    }

    return {
      success: true,
      data: {
        id: reminder.id,
        employeeName: reminder.employees.name,
        employeeId: reminder.employees.employee_id,
        employeeEmail: reminder.employees.email,
        type: reminder.reminder_types.name,
        reminderTypeId: reminder.reminder_type_id,
        dueDate: reminder.due_date,
        notes: reminder.notes,
        daysRemaining,
        status,
        completedAt: completionData?.completed_at || null,
      },
    }
  } catch (error) {
    console.error("Error in getReminderById:", error)
    return { success: false, error: (error as Error).message }
  }
}

// Update the updateReminder function to include priority

export async function updateReminder(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  try {
    const reminderTypeId = formData.get("reminder_type_id") as string
    const dueDate = formData.get("due_date") as string
    const notes = formData.get("notes") as string
    const priority = (formData.get("priority") as string) || "medium"

    const { error } = await supabase
      .from("employee_reminders")
      .update({
        reminder_type_id: reminderTypeId,
        due_date: dueDate,
        notes: notes,
        priority: priority,
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating reminder:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/reminders/${id}`)
    revalidatePath("/reminders")
    return { success: true }
  } catch (error) {
    console.error("Error in updateReminder:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function deleteReminder(id: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { error } = await supabase.from("employee_reminders").delete().eq("id", id)

    if (error) {
      console.error("Error deleting reminder:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/reminders")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteReminder:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function markReminderAsComplete(id: string) {
  try {
    const response = await fetch(`/api/reminders/${id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to mark reminder as complete');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in markReminderAsComplete:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark reminder as complete' 
    };
  }
}

