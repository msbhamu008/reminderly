"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function getEmployees(searchQuery = "") {
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from("employees")
    .select(`
      id,
      employee_id,
      name,
      email,
      position,
      department,
      manager_email,
      hr_email,
      employee_reminders (
        id,
        due_date,
        reminder_types (
          name
        )
      )
    `)
    .order("name")

  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,employee_id.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching employees:", error)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((employee) => ({
      ...employee,
      reminders: employee.employee_reminders.map((reminder) => ({
        type: reminder.reminder_types.name,
        dueDate: reminder.due_date,
      })),
    })),
  }
}

export async function addEmployee(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const employee = {
    employee_id: formData.get("employee_id") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    position: formData.get("position") as string,
    department: formData.get("department") as string,
    manager_email: formData.get("manager_email") as string,
    hr_email: formData.get("hr_email") as string,
  }

  const { data, error } = await supabase.from("employees").insert(employee).select()

  if (error) {
    console.error("Error adding employee:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/employees")
  return { success: true, data: data[0] }
}

export async function updateEmployee(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const employee = {
    employee_id: formData.get("employee_id") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    position: formData.get("position") as string,
    department: formData.get("department") as string,
    manager_email: formData.get("manager_email") as string,
    hr_email: formData.get("hr_email") as string,
  }

  const { data, error } = await supabase.from("employees").update(employee).eq("id", id).select()

  if (error) {
    console.error("Error updating employee:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/employees")
  return { success: true, data: data[0] }
}

export async function deleteEmployee(id: string) {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("employees").delete().eq("id", id)

  if (error) {
    console.error("Error deleting employee:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/employees")
  return { success: true }
}

