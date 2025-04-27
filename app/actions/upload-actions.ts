"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import * as XLSX from "xlsx"

export type UploadedEmployee = {
  employeeId: string
  name: string
  email: string
  position: string
  department: string
  managerEmail: string
  hrEmail: string
  reminderType: string
  dueDate: string
}

export async function parseExcelFile(fileBuffer: ArrayBuffer): Promise<{ headers: string[]; data: any[] }> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Convert sheet to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // Extract headers (first row)
    const headers = data[0] as string[]

    // Remove header row
    const rows = data.slice(1)

    return { headers, data: rows }
  } catch (error) {
    console.error("Error parsing Excel file:", error)
    throw new Error("Failed to parse Excel file")
  }
}

export async function uploadEmployeeData(data: any[], columnMapping: Record<string, number>, reminderTypeId: string) {
  const supabase = createServerSupabaseClient()
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const row of data) {
    try {
      // Map columns to employee data
      const employee = {
        employee_id: row[columnMapping.employeeId] || `EMP${Math.floor(Math.random() * 10000)}`,
        name: row[columnMapping.name],
        email: row[columnMapping.email] || "",
        position: row[columnMapping.position] || "",
        department: row[columnMapping.department] || "",
        manager_email: row[columnMapping.managerEmail] || "",
        hr_email: row[columnMapping.hrEmail] || "",
      }

      // Skip if required fields are missing
      if (!employee.name) {
        results.failed++
        results.errors.push(`Missing name for row: ${JSON.stringify(row)}`)
        continue
      }

      // Insert or update employee
      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .upsert(employee, { onConflict: "employee_id" })
        .select()

      if (employeeError) {
        results.failed++
        results.errors.push(`Error adding employee ${employee.name}: ${employeeError.message}`)
        continue
      }

      const employeeId = employeeData[0].id

      // Get the due date from the row
      const dueDate = row[columnMapping.dueDate]
      if (!dueDate) {
        results.failed++
        results.errors.push(`Missing due date for employee ${employee.name}`)
        continue
      }

      // Format the date based on the type of data
      let formattedDate: string

      // Handle Excel numeric dates
      if (typeof dueDate === "number") {
        try {
          const dateObj = XLSX.SSF.parse_date_code(dueDate)
          if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
            formattedDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`
          } else {
            // If parse_date_code fails, try another approach for numeric dates
            const excelEpoch = new Date(1899, 11, 30)
            const dateObj = new Date(excelEpoch.getTime() + (dueDate - 1) * 24 * 60 * 60 * 1000)
            formattedDate = dateObj.toISOString().split("T")[0]
          }
        } catch (error) {
          results.failed++
          results.errors.push(`Error parsing date for employee ${employee.name}: ${error}`)
          continue
        }
      }
      // Handle string dates
      else if (typeof dueDate === "string") {
        // Try to parse the date string
        const dateObj = new Date(dueDate)
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toISOString().split("T")[0]
        } else {
          results.failed++
          results.errors.push(`Invalid date format for employee ${employee.name}: ${dueDate}`)
          continue
        }
      }
      // Handle date objects
      else if (dueDate instanceof Date) {
        formattedDate = dueDate.toISOString().split("T")[0]
      } else {
        results.failed++
        results.errors.push(`Unknown date format for employee ${employee.name}: ${dueDate}`)
        continue
      }

      // Add the reminder
      const { error: reminderError } = await supabase.from("employee_reminders").insert({
        employee_id: employeeId,
        reminder_type_id: reminderTypeId,
        due_date: formattedDate,
      })

      if (reminderError) {
        results.failed++
        results.errors.push(`Error adding reminder for ${employee.name}: ${reminderError.message}`)
        continue
      }

      results.success++
    } catch (error) {
      results.failed++
      results.errors.push(`Unexpected error processing row: ${(error as Error).message}`)
    }
  }

  revalidatePath("/upload")
  revalidatePath("/reminders")
  revalidatePath("/employees")

  return results
}

export async function getReminderTypesForUpload() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase.from("reminder_types").select("id, name").eq("enabled", true).order("name")

  if (error) {
    console.error("Error fetching reminder types:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

