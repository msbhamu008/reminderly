"use client"

import type React from "react"

import { useEffect, useState, useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CalendarIcon, MoreHorizontal, PlusCircle, Search, UserPlus, FileSpreadsheet } from "lucide-react"
import { getEmployees, addEmployee, updateEmployee, deleteEmployee, bulkDeleteEmployees } from "../actions/employee-actions"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getReminderTypes, addEmployeeReminder } from "../actions/reminder-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadEmployeeData, getReminderTypesForUpload } from "../actions/upload-actions"
import * as XLSX from "xlsx"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { BulkReminderDialog } from "@/components/reminder/bulk-reminder-dialog"

type Employee = {
  id: string
  employee_id: string
  name: string
  email: string
  position: string
  department: string
  manager_email: string
  hr_email: string
  reminders: { type: string; dueDate: string }[]
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [reminderTypes, setReminderTypes] = useState<{ id: string; name: string }[]>([])
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadStep, setUploadStep] = useState<"select" | "preview" | "complete">("select")
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({})
  const [reminderTypeId, setReminderTypeId] = useState<string>("")
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [showBulkDeleteAlert, setShowBulkDeleteAlert] = useState(false)
  const [showBulkReminderDialog, setShowBulkReminderDialog] = useState(false)
  const [selectedEmployeeForReminders, setSelectedEmployeeForReminders] = useState<string | null>(null)
  const [isBulkReminderDialogOpen, setIsBulkReminderDialogOpen] = useState(false)
  const { toast } = useToast()

  const employeeFormRef = useRef<HTMLFormElement>(null)
  const editEmployeeFormRef = useRef<HTMLFormElement>(null)
  const reminderFormRef = useRef<HTMLFormElement>(null)

  // Load employees
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true)
      const response = await getEmployees(searchQuery)

      if (response.success) {
        setEmployees(response.data)
      } else {
        toast({
          title: "Error",
          description: "Failed to load employees",
          variant: "destructive",
        })
      }

      setLoading(false)
    }

    fetchEmployees()
  }, [searchQuery, toast])

  // Load reminder types
  useEffect(() => {
    const fetchReminderTypes = async () => {
      const response = await getReminderTypes()

      if (response.success) {
        setReminderTypes(response.data)
      }
    }

    fetchReminderTypes()
  }, [])

  const handleAddEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const response = await addEmployee(formData)

        if (response.success) {
          setEmployees((prev) => [
            ...prev,
            {
              ...response.data,
              reminders: [],
            },
          ])

          setIsAddDialogOpen(false)

          toast({
            title: "Success",
            description: "Employee added successfully",
          })

          // Reset form using the ref
          if (employeeFormRef.current) {
            employeeFormRef.current.reset()
          }
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to add employee",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error adding employee:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleEditEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!selectedEmployee) return

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const response = await updateEmployee(selectedEmployee.id, formData)

        if (response.success) {
          setEmployees((prev) =>
            prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...response.data } : emp)),
          )

          setIsEditDialogOpen(false)

          toast({
            title: "Success",
            description: "Employee updated successfully",
          })
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to update employee",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error updating employee:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleDeleteEmployee = (id: string) => {
    if (!confirm("Are you sure you want to delete this employee? This will also delete all associated reminders.")) {
      return
    }

    startTransition(async () => {
      try {
        const response = await deleteEmployee(id)

        if (response.success) {
          setEmployees((prev) => prev.filter((employee) => employee.id !== id))

          toast({
            title: "Success",
            description: "Employee deleted successfully",
          })
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to delete employee",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error deleting employee:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleAddReminder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!selectedEmployee) return

    const formData = new FormData(e.currentTarget)
    formData.append("employee_id", selectedEmployee.id)

    startTransition(async () => {
      try {
        const response = await addEmployeeReminder(formData)

        if (response.success) {
          // Refresh the employee list to get the updated reminders
          const employeesResponse = await getEmployees(searchQuery)

          if (employeesResponse.success) {
            setEmployees(employeesResponse.data)
          }

          setIsAddReminderOpen(false)

          toast({
            title: "Success",
            description: "Reminder added successfully",
          })

          // Reset form using the ref
          if (reminderFormRef.current) {
            reminderFormRef.current.reset()
          }
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to add reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error adding reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      const headers = jsonData[0] as string[]
      const rows = jsonData.slice(1)

      setHeaders(headers)
      setPreviewData(rows)
      setUploadStep("preview")
    }
    reader.readAsArrayBuffer(file)
    setFile(file)
  }

  const handleUpload = async () => {
    if (!file || !reminderTypeId) return

    const mappedData = previewData.map((row) => {
      const mappedRow: Record<string, string> = {}
      Object.keys(columnMapping).forEach((key) => {
        mappedRow[key] = row[columnMapping[key]] || ""
      })
      return mappedRow
    })

    const response = await uploadEmployeeData(mappedData, reminderTypeId)

    if (response.success) {
      toast({
        title: "Success",
        description: "Employee data uploaded successfully",
      })
      setUploadStep("complete")
    } else {
      toast({
        title: "Error",
        description: response.error || "Failed to upload employee data",
        variant: "destructive",
      })
    }
  }

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId])
    } else {
      setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId))
    }
  }

  const handleSelectAllEmployees = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(employees.map(emp => emp.id))
    } else {
      setSelectedEmployees([])
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedEmployees.length) return

    if (confirm(`Are you sure you want to delete ${selectedEmployees.length} employees?`)) {
      const result = await bulkDeleteEmployees(selectedEmployees)
      if (result.success) {
        toast({
          title: "Success",
          description: "Employees deleted successfully",
        })
        setSelectedEmployees([])
        setEmployees(prev => prev.filter(emp => !selectedEmployees.includes(emp.id)))
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete employees",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage employee information and associated reminders</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Employees</CardTitle>
                <CardDescription>View and manage employee information</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search employees..."
                    className="pl-8 w-full sm:w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Employee
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Employee</DialogTitle>
                      <DialogDescription>Enter the details of the new employee.</DialogDescription>
                    </DialogHeader>

                    <form ref={employeeFormRef} onSubmit={handleAddEmployee}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="employee_id" className="text-right">
                            Employee ID
                          </Label>
                          <Input
                            id="employee_id"
                            name="employee_id"
                            placeholder="EMP001"
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="name" className="text-right">
                            Name
                          </Label>
                          <Input id="name" name="name" placeholder="John Doe" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="email" className="text-right">
                            Email
                          </Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="john.doe@example.com"
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="manager_email" className="text-right">
                            Manager Email
                          </Label>
                          <Input
                            id="manager_email"
                            name="manager_email"
                            type="email"
                            placeholder="manager@example.com"
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="hr_email" className="text-right">
                            HR Email
                          </Label>
                          <Input
                            id="hr_email"
                            name="hr_email"
                            type="email"
                            placeholder="hr@example.com"
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="position" className="text-right">
                            Position
                          </Label>
                          <Input id="position" name="position" placeholder="Developer" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="department" className="text-right">
                            Department
                          </Label>
                          <Input id="department" name="department" placeholder="Engineering" className="col-span-3" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                          {isPending ? "Adding..." : "Add Employee"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button onClick={() => setIsUploadDialogOpen(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Upload Employees
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete} disabled={selectedEmployees.length === 0}>
                  Delete Selected ({selectedEmployees.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : employees.length > 0 ? (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Checkbox
                          checked={selectedEmployees.length === employees.length}
                          onCheckedChange={(checked) => handleSelectAllEmployees(!!checked)}
                        />
                      </TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Reminders</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEmployees.includes(employee.id)}
                            onCheckedChange={(checked) => handleSelectEmployee(employee.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>{employee.employee_id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-sm text-muted-foreground">{employee.email}</div>
                        </TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {employee.reminders && employee.reminders.length > 0 ? (
                              employee.reminders.map((reminder, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Badge variant="outline">{reminder.type}</Badge>
                                  <div className="flex items-center text-xs text-muted-foreground">
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {new Date(reminder.dueDate).toLocaleDateString()}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground">No reminders</div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-7 w-7 p-0"
                              onClick={() => {
                                setSelectedEmployee(employee)
                                setIsAddReminderOpen(true)
                              }}
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              <span className="sr-only">Add reminder</span>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedEmployee(employee)
                                  setIsEditDialogOpen(true)
                                }}
                              >
                                Edit Employee
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedEmployee(employee)
                                  setIsAddReminderOpen(true)
                                }}
                              >
                                Add Reminder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteEmployee(employee.id)}>
                                Delete Employee
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="rounded-full bg-muted p-3">
                  <UserPlus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No employees found</h3>
                <p className="mt-2 text-sm text-center text-muted-foreground">
                  {searchQuery ? "Try adjusting your search to see more results." : "Add employees to get started."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information.</DialogDescription>
          </DialogHeader>

          {selectedEmployee && (
            <form ref={editEmployeeFormRef} onSubmit={handleEditEmployee}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_employee_id" className="text-right">
                    Employee ID
                  </Label>
                  <Input
                    id="edit_employee_id"
                    name="employee_id"
                    defaultValue={selectedEmployee.employee_id}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="edit_name"
                    name="name"
                    defaultValue={selectedEmployee.name}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="edit_email"
                    name="email"
                    type="email"
                    defaultValue={selectedEmployee.email}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_manager_email" className="text-right">
                    Manager Email
                  </Label>
                  <Input
                    id="edit_manager_email"
                    name="manager_email"
                    type="email"
                    defaultValue={selectedEmployee.manager_email || ""}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_hr_email" className="text-right">
                    HR Email
                  </Label>
                  <Input
                    id="edit_hr_email"
                    name="hr_email"
                    type="email"
                    defaultValue={selectedEmployee.hr_email || ""}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_position" className="text-right">
                    Position
                  </Label>
                  <Input
                    id="edit_position"
                    name="position"
                    defaultValue={selectedEmployee.position}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_department" className="text-right">
                    Department
                  </Label>
                  <Input
                    id="edit_department"
                    name="department"
                    defaultValue={selectedEmployee.department}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Reminder Dialog */}
      <Dialog open={isAddReminderOpen} onOpenChange={setIsAddReminderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reminder for {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>Set up a new reminder for this employee.</DialogDescription>
          </DialogHeader>

          <form ref={reminderFormRef} onSubmit={handleAddReminder}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reminder_type_id" className="text-right">
                  Reminder Type
                </Label>
                <Select name="reminder_type_id" required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a reminder type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="due_date" className="text-right">
                  Due Date
                </Label>
                <Input id="due_date" name="due_date" type="date" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notes
                </Label>
                <Input id="notes" name="notes" className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding..." : "Add Reminder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Upload Employee Data</DialogTitle>
            <DialogDescription>Upload an Excel file containing employee information</DialogDescription>
          </DialogHeader>

          {uploadStep === "select" && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <div className="flex flex-col items-center text-center">
                <h3 className="font-medium">Drag and drop your Excel file</h3>
                <p className="text-sm text-muted-foreground mb-4">or click to browse files (XLSX, XLS, CSV)</p>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="max-w-sm"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {uploadStep === "preview" && (
            <div>
              <h3 className="font-medium mb-4">Preview Data</h3>
              <div className="overflow-auto">
                <table className="table-auto w-full border-collapse border border-gray-200">
                  <thead>
                    <tr>
                      {headers.map((header, index) => (
                        <th key={index} className="border border-gray-200 px-4 py-2">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="border border-gray-200 px-4 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleUpload} className="mt-4">
                Upload Data
              </Button>
            </div>
          )}

          {uploadStep === "complete" && (
            <div className="text-center">
              <h3 className="font-medium">Upload Complete</h3>
              <p className="text-sm text-muted-foreground">Employee data has been successfully uploaded.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Alert */}
      <AlertDialog open={showBulkDeleteAlert} onOpenChange={setShowBulkDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected employees? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedEmployeeForReminders && (
        <BulkReminderDialog
          isOpen={isBulkReminderDialogOpen}
          onClose={() => {
            setIsBulkReminderDialogOpen(false)
            setSelectedEmployeeForReminders(null)
          }}
          employeeId={selectedEmployeeForReminders}
          reminderTypes={reminderTypes}
        />
      )}
    </div>
  )
}

