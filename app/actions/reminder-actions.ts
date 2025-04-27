"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { createClient } from '@/lib/supabase/client'
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email-service-part2"

// TypeScript types for Supabase query results
type Employee = {
  id: string;
  name: string;
  email: string;
  manager_email: string | null;
  hr_email: string | null;
}

type ReminderType = {
  id: string;
  name: string;
  email_templates: Array<{
    subject_template: string;
    body_template: string;
  }>;
  recipients: Array<{
    notify_employee: boolean;
    notify_manager: boolean;
    notify_hr: boolean;
    additional_emails: string[];
  }>;
}

type Reminder = {
  id: string;
  due_date: string;
  employees: Employee;
  reminder_types: ReminderType;
}

type EmployeeRecord = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  manager_email: string | null;
  hr_email: string | null;
}

type ReminderTypeRecord = {
  id: string;
  name: string;
  email_templates: Array<{
    subject_template: string;
    body_template: string;
  }>;
  recipients: Array<{
    notify_employee: boolean;
    notify_manager: boolean;
    notify_hr: boolean;
    additional_emails: string[];
  }>;
}

type ReminderQueryResult = {
  id: string;
  due_date: string;
  employees: EmployeeRecord;
  reminder_types: ReminderTypeRecord;
  reminder_logs?: Array<{
    id: string;
    sent_at: string;
  }>;
}

type EmailRecipient = {
  email: string;
  name: string;
  role?: string;
}

type DatabaseReminder = {
  id: string;
  due_date: string;
  employees: {
    id: string;
    name: string;
    email: string;
    manager_email: string | null;
    hr_email: string | null;
  };
  reminder_types: {
    id: string;
    name: string;
    email_templates?: Array<{
      subject_template: string;
      body_template: string;
    }>;
    recipients: Array<{
      notify_employee: boolean;
      notify_manager: boolean;
      notify_hr: boolean;
      additional_emails: string[];
    }>;
  };
}

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

  // Add default email template for HR/Management
  const { error: templateError } = await supabase.from("email_templates").insert({
    reminder_type_id: typeId,
    subject_template: `[${name}] Action Required: {employee}'s Document Expiring in {days}`,
    body_template: `Dear {recipient},

This is to inform you that {employee}'s ${name} is due for renewal/review {days} (on {date}).

Document Type: ${name}
Employee: {employee}
Due Date: {date}

Please take appropriate action to ensure timely renewal/review of this document.

Best regards,
HR Department`,
  })

  if (templateError) {
    console.error("Error adding default email template:", templateError)
  }

  // Add default recipients configuration - only notify management
  const { error: recipientsError } = await supabase.from("recipients").insert({
    reminder_type_id: typeId,
    notify_employee: false, // Don't notify employees by default
    notify_manager: true,   // Always notify managers
    notify_hr: true,        // Always notify HR
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

function getNextOccurrenceDate(originalDate: Date): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nextDate = new Date(originalDate)
  nextDate.setFullYear(today.getFullYear())

  if (nextDate < today) {
    nextDate.setFullYear(today.getFullYear() + 1)
  }

  return nextDate
}

export async function getReminders(filterType = "all", searchQuery = "") {
  const supabase = createServerSupabaseClient()

  try {
    let query = supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        employees!inner (
          id,
          employee_id,
          name,
          email,
          manager_email,
          hr_email
        ),
        reminder_types!inner (
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
      .order("due_date")

    if (filterType !== "all") {
      query = query.eq("reminder_types.name", filterType)
    }

    if (searchQuery) {
      query = query.or(`employees.name.ilike.%${searchQuery}%,employees.employee_id.ilike.%${searchQuery}%`)
    }

    const { data: remindersData, error } = await query

    if (error) {
      console.error("Error fetching reminders:", error)
      return { success: false, error: error.message }
    }

    // Cast and transform the data to match our expected structure
    const reminders = (remindersData || []).map(item => ({
      id: item.id,
      due_date: item.due_date,
      employees: item.employees as unknown as EmployeeRecord,
      reminder_types: item.reminder_types as unknown as ReminderTypeRecord,
      reminder_logs: item.reminder_logs || []
    }))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      success: true,
      data: reminders.map((reminder) => {
        const originalDueDate = new Date(reminder.due_date)
        originalDueDate.setHours(0, 0, 0, 0)

        const dueDate = getNextOccurrenceDate(originalDueDate)

        const diffTime = dueDate.getTime() - today.getTime()
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let status = "pending"
        if (reminder.reminder_logs && reminder.reminder_logs.length > 0) {
          const completedLog = reminder.reminder_logs.find(log => log.status === "completed")
          status = completedLog ? "completed" : "sent"
        }

        return {
          id: reminder.id,
          employeeName: reminder.employees.name,
          employeeId: reminder.employees.employee_id,
          email: reminder.employees.email,
          hrEmail: reminder.employees.hr_email,
          managerEmail: reminder.employees.manager_email,
          type: reminder.reminder_types.name,
          dueDate: dueDate.toISOString(),
          daysRemaining,
          status,
        }
      }),
    }
  } catch (error) {
    console.error("Error in getReminders:", error)
    return { success: false, error: (error as Error).message }
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
    const { data: reminderData, error: reminderError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        employees!inner (
          id,
          name,
          email,
          manager_email,
          hr_email
        ),
        reminder_types!inner (
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

    if (reminderError || !reminderData) {
      console.error("Error fetching reminder details:", reminderError)
      return { success: false, error: reminderError?.message || "Reminder not found" }
    }

    const reminder: DatabaseReminder = {
      id: reminderData.id,
      due_date: reminderData.due_date,
      employees: {
        id: reminderData.employees[0].id,
        name: reminderData.employees[0].name,
        email: reminderData.employees[0].email,
        manager_email: reminderData.employees[0].manager_email,
        hr_email: reminderData.employees[0].hr_email
      },
      reminder_types: {
        id: reminderData.reminder_types[0].id,
        name: reminderData.reminder_types[0].name,
        email_templates: reminderData.reminder_types[0].email_templates,
        recipients: reminderData.reminder_types[0].recipients || []
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(reminder.due_date)
    dueDate.setHours(0, 0, 0, 0)
    const diffTime = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const emailTemplate = reminder.reminder_types.email_templates?.[0]
    if (!emailTemplate) {
      return { success: false, error: "No email template found for this reminder type" }
    }

    const recipientsConfig = reminder.reminder_types.recipients[0]
    if (!recipientsConfig) {
      return { success: false, error: "No recipients configuration found for this reminder type" }
    }

    // Create recipient list with their roles, prioritizing management
    const recipientList: Array<{email: string; name: string; role: string}> = []
    const managementEmails: string[] = []

    // Always add HR first if configured and available
    if (recipientsConfig.notify_hr && reminder.employees.hr_email) {
      recipientList.push({
        email: reminder.employees.hr_email,
        name: 'HR',
        role: 'HR Department'
      })
      managementEmails.push(reminder.employees.hr_email)
    }

    // Then add manager if configured and available
    if (recipientsConfig.notify_manager && reminder.employees.manager_email) {
      recipientList.push({
        email: reminder.employees.manager_email,
        name: 'Manager',
        role: 'Manager'
      })
      managementEmails.push(reminder.employees.manager_email)
    }

    // Add any additional emails from the configuration
    if (recipientsConfig.additional_emails && Array.isArray(recipientsConfig.additional_emails)) {
      recipientsConfig.additional_emails.forEach((email: string) => {
        recipientList.push({
          email,
          name: 'Additional Recipient',
          role: 'Management Team'
        })
        managementEmails.push(email)
      })
    }

    // Only add employee if explicitly configured AND it's enabled
    if (recipientsConfig.notify_employee && reminder.employees.email) {
      recipientList.push({
        email: reminder.employees.email,
        name: reminder.employees.name,
        role: 'Employee'
      })
    }

    if (recipientList.length === 0) {
      return { success: false, error: "No recipients found for this reminder" }
    }

    let successfulSends = 0
    const daysText = daysRemaining <= 0 ? "today" : `in ${daysRemaining} days`

    // Send personalized email to each recipient
    for (const recipient of recipientList) {
      const templateVariables = {
        type: reminder.reminder_types.name,
        employee: reminder.employees.name,
        days: daysText,
        date: new Date(reminder.due_date).toLocaleDateString(),
        recipient: recipient.role
      }

      const subject = replaceTemplateVariables(emailTemplate.subject_template, templateVariables)
      const body = replaceTemplateVariables(emailTemplate.body_template, templateVariables)

      const emailResult = await sendEmail({
        to: [{
          email: recipient.email,
          name: recipient.name,
          role: recipient.role
        }],
        subject,
        html: body,
      })

      if (emailResult.success) {
        successfulSends++
      }
    }

    // Only proceed with status updates if at least one management email was sent
    if (managementEmails.length > 0 && successfulSends > 0) {
      // Use the new database function to update status
      const { error: updateError } = await supabase
        .rpc('update_reminder_status', {
          reminder_id: reminder.id,
          management_emails: managementEmails,
          days_before: daysRemaining
        })

      if (updateError) {
        console.error("Error updating reminder status:", updateError)
        return { 
          success: false, 
          error: "Failed to update reminder status"
        }
      }
    }

    revalidatePath("/reminders")
    revalidatePath(`/reminders/${reminder.id}`)

    return { 
      success: managementEmails.length > 0 && successfulSends > 0,
      error: managementEmails.length === 0 ? "Failed to send to any management recipients" : undefined,
      messageId: `Sent to ${successfulSends} recipient(s)`
    }
  } catch (error) {
    console.error("Error in sendReminderNow:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send reminder" 
    }
  }
}

export async function sendBulkReminders(reminderIds: string[]) {
  try {
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .in('id', reminderIds);

    if (error) throw error;

    let sent = 0;
    let failed = 0;
    const sentIds: string[] = [];

    for (const reminder of reminders) {
      try {
        const result = await sendReminder(reminder.id);
        if (result.success) {
          sent++;
          sentIds.push(reminder.id);
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return {
      success: true,
      sent,
      failed,
      sentIds
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to send bulk reminders',
      sent: 0,
      failed: reminderIds.length
    };
  }
}

export async function getReminderById(id: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { data: reminderData, error: reminderError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        reminder_type_id,
        notes,
        employees!inner (
          id,
          name,
          email,
          employee_id,
          manager_email,
          hr_email
        ),
        reminder_types!inner (
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
        ),
        reminder_logs (
          id,
          sent_at,
          recipients,
          status
        )
      `)
      .eq("id", id)
      .single()

    if (reminderError || !reminderData) {
      console.error("Error fetching reminder:", reminderError)
      return { success: false, error: reminderError?.message || "Reminder not found" }
    }

    const { data: completionData } = await supabase
      .from("reminder_logs")
      .select("sent_at")
      .eq("employee_reminder_id", id)
      .eq("status", "completed")
      .maybeSingle()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(reminderData.due_date)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let status = "pending"
    if (completionData) {
      status = "completed"
    } else if (reminderData.reminder_logs && reminderData.reminder_logs.length > 0) {
      status = "sent"
    }

    // Type assertion for nested objects
    const employees = reminderData.employees as unknown as {
      name: string;
      employee_id: string;
      email: string;
      manager_email: string | null;
      hr_email: string | null;
    }

    const reminderType = reminderData.reminder_types as unknown as {
      name: string;
    }

    return {
      success: true,
      data: {
        id: reminderData.id,
        employeeName: employees.name,
        employeeId: employees.employee_id,
        employeeEmail: employees.email,
        managerEmail: employees.manager_email,
        hrEmail: employees.hr_email,
        type: reminderType.name,
        reminderTypeId: reminderData.reminder_type_id,
        dueDate: reminderData.due_date,
        daysRemaining,
        status,
        notes: reminderData.notes || "",
        lastSentAt: reminderData.reminder_logs?.[0]?.sent_at || null,
        completedAt: completionData?.sent_at || null,
        logs: reminderData.reminder_logs || []
      }
    }
  } catch (error) {
    console.error("Error in getReminderById:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function updateReminder(id: string, formData: FormData | string, dueDate?: string) {
  const supabase = createServerSupabaseClient()

  try {
    let updateData: any = {}

    if (formData instanceof FormData) {
      // Handle FormData case
      updateData = {
        reminder_type_id: formData.get("reminder_type_id"),
        due_date: formData.get("due_date"),
        notes: formData.get("notes"),
      }

      const { error } = await supabase
        .from("employee_reminders")
        .update(updateData)
        .eq("id", id)

      if (error) {
        console.error("Error updating reminder:", error)
        return { success: false, error: error.message }
      }
    } else if (typeof formData === 'string' && formData === 'completed') {
      // For completion, we only add a log entry - no need to update the main record
      const { error: logError } = await supabase
        .from("reminder_logs")
        .insert({
          employee_reminder_id: id,
          days_before: 0,
          recipients: [],
          status: "completed",
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

      if (logError) {
        console.error("Error logging completion:", logError)
        return { success: false, error: logError.message }
      }
    } else if (typeof formData === 'string' && formData === 'pending' && dueDate) {
      // Handle rescheduling case
      const { error } = await supabase
        .from("employee_reminders")
        .update({ due_date: dueDate })
        .eq("id", id)

      if (error) {
        console.error("Error updating reminder:", error)
        return { success: false, error: error.message }
      }
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
  const supabase = createServerSupabaseClient()

  try {
    // Log the completion in reminder_logs
    const { error: logError } = await supabase.from("reminder_logs").insert({
      employee_reminder_id: id,
      days_before: 0, // Since it's a completion, not a reminder
      recipients: [], // No recipients for completion
      status: "completed",
      sent_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })

    if (logError) {
      console.error("Error logging reminder completion:", logError)
      return { success: false, error: logError.message }
    }

    revalidatePath(`/reminders/${id}`)
    revalidatePath("/reminders")
    
    return { success: true }
  } catch (error) {
    console.error("Error in markReminderAsComplete:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to mark reminder as complete"
    }
  }
}

export async function bulkAddReminders(employeeId: string, reminders: { reminder_type_id: string; due_date: string; notes?: string }[]) {
  try {
    const response = await supabaseClient
      .from('employee_reminders')
      .insert(
        reminders.map(reminder => ({
          employee_id: employeeId,
          reminder_type_id: reminder.reminder_type_id,
          due_date: reminder.due_date,
          notes: reminder.notes
        }))
      )
      .select()

    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    console.error('Error adding bulk reminders:', error)
    return {
      success: false,
      error: 'Failed to add reminders'
    }
  }
}

export async function createBulkReminders(formData: FormData) {
  const supabase = createClient()
  const file = formData.get('file') as File
  const employeeId = formData.get('employeeId') as string

  if (!file || !employeeId) {
    return { success: false, error: 'Missing required data' }
  }

  try {
    const text = await file.text()
    const rows = text.split('\n').slice(1) // Skip header row
    
    const reminders = rows.flatMap(row => {
      // Split the row and trim each cell
      const cells = row.split(',').map(cell => cell.trim())
      
      // First cell is employee email/id (if needed for verification)
      // Following cells are grouped in sets of 4 (title, description, due_date, type)
      const reminderSets = []
      
      // Start from index 1 if first column is employee identifier
      for (let i = 0; i < cells.length; i += 4) {
        const [title, description, due_date, type] = cells.slice(i, i + 4)
        
        // Only create reminder if all required fields are present
        if (title && due_date && type) {
          reminderSets.push({
            title,
            description: description || '',
            due_date,
            type,
            employee_id: employeeId,
            status: 'pending',
            created_at: new Date().toISOString()
          })
        }
      }
      
      return reminderSets
    }).filter(reminder => reminder.title && reminder.due_date && reminder.type)

    if (reminders.length === 0) {
      return { success: false, error: 'No valid reminders found in CSV' }
    }

    const { error } = await supabase
      .from('reminders')
      .insert(reminders)

    if (error) {
      console.error('Error creating bulk reminders:', error)
      return { success: false, error: 'Failed to create reminders' }
    }

    revalidatePath('/employees')
    revalidatePath('/reminders')
    return { success: true }
  } catch (error) {
    console.error('Error in createBulkReminders:', error)
    return { success: false, error: 'Failed to process CSV file' }
  }
}

