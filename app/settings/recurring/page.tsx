"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CalendarIcon, Loader2, Plus, RefreshCw, Trash } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  getRecurringReminders,
  createRecurringReminder,
  updateRecurringReminder,
  deleteRecurringReminder,
  getReminderTypes,
} from "@/app/actions/recurring-actions"

type RecurringReminder = {
  id: string
  name: string
  reminderTypeId: string
  reminderTypeName: string
  frequency: string
  interval: number
  nextDueDate: string
  enabled: boolean
}

export default function RecurringRemindersPage() {
  const [reminders, setReminders] = useState<RecurringReminder[]>([])
  const [reminderTypes, setReminderTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<RecurringReminder | null>(null)
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState<Date>()
  const { toast } = useToast()

  const [newReminder, setNewReminder] = useState({
    name: "",
    reminderTypeId: "",
    frequency: "monthly",
    interval: 1,
    enabled: true,
  })

  // Load recurring reminders
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      try {
        // Fetch recurring reminders
        const remindersResponse = await getRecurringReminders()

        if (remindersResponse.success) {
          setReminders(remindersResponse.data)
        } else {
          toast({
            title: "Error",
            description: "Failed to load recurring reminders",
            variant: "destructive",
          })
        }

        // Fetch reminder types
        const typesResponse = await getReminderTypes()

        if (typesResponse.success) {
          setReminderTypes(typesResponse.data)
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const handleCreateReminder = () => {
    if (!newReminder.name || !newReminder.reminderTypeId || !date) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("name", newReminder.name)
        formData.append("reminder_type_id", newReminder.reminderTypeId)
        formData.append("frequency", newReminder.frequency)
        formData.append("interval", newReminder.interval.toString())
        formData.append("next_due_date", date.toISOString().split("T")[0])
        formData.append("enabled", newReminder.enabled.toString())

        const response = await createRecurringReminder(formData)

        if (response.success) {
          toast({
            title: "Success",
            description: "Recurring reminder created successfully",
          })

          // Reset form
          setNewReminder({
            name: "",
            reminderTypeId: "",
            frequency: "monthly",
            interval: 1,
            enabled: true,
          })
          setDate(undefined)
          setIsAddDialogOpen(false)

          // Refresh reminders
          const refreshResponse = await getRecurringReminders()
          if (refreshResponse.success) {
            setReminders(refreshResponse.data)
          }
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to create recurring reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error creating recurring reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleUpdateReminder = () => {
    if (!selectedReminder || !date) return

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("name", selectedReminder.name)
        formData.append("reminder_type_id", selectedReminder.reminderTypeId)
        formData.append("frequency", selectedReminder.frequency)
        formData.append("interval", selectedReminder.interval.toString())
        formData.append("next_due_date", date.toISOString().split("T")[0])
        formData.append("enabled", selectedReminder.enabled.toString())

        const response = await updateRecurringReminder(selectedReminder.id, formData)

        if (response.success) {
          toast({
            title: "Success",
            description: "Recurring reminder updated successfully",
          })

          setIsEditDialogOpen(false)

          // Refresh reminders
          const refreshResponse = await getRecurringReminders()
          if (refreshResponse.success) {
            setReminders(refreshResponse.data)
          }
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to update recurring reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error updating recurring reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleDeleteReminder = (id: string) => {
    startTransition(async () => {
      try {
        const response = await deleteRecurringReminder(id)

        if (response.success) {
          toast({
            title: "Success",
            description: "Recurring reminder deleted successfully",
          })

          // Refresh reminders
          const refreshResponse = await getRecurringReminders()
          if (refreshResponse.success) {
            setReminders(refreshResponse.data)
          }
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to delete recurring reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error deleting recurring reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    const reminder = reminders.find((r) => r.id === id)
    if (!reminder) return

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("name", reminder.name)
        formData.append("reminder_type_id", reminder.reminderTypeId)
        formData.append("frequency", reminder.frequency)
        formData.append("interval", reminder.interval.toString())
        formData.append("next_due_date", reminder.nextDueDate)
        formData.append("enabled", (!enabled).toString())

        const response = await updateRecurringReminder(id, formData)

        if (response.success) {
          toast({
            title: "Success",
            description: `Recurring reminder ${enabled ? "disabled" : "enabled"} successfully`,
          })

          // Update local state
          setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)))
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to update recurring reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error updating recurring reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const openEditDialog = (reminder: RecurringReminder) => {
    setSelectedReminder(reminder)
    setDate(new Date(reminder.nextDueDate))
    setIsEditDialogOpen(true)
  }

  const getFrequencyText = (frequency: string, interval: number) => {
    switch (frequency) {
      case "daily":
        return interval === 1 ? "Daily" : `Every ${interval} days`
      case "weekly":
        return interval === 1 ? "Weekly" : `Every ${interval} weeks`
      case "monthly":
        return interval === 1 ? "Monthly" : `Every ${interval} months`
      case "yearly":
        return interval === 1 ? "Yearly" : `Every ${interval} years`
      default:
        return "Custom"
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Recurring Reminders</h1>
            <p className="text-muted-foreground">Set up reminders that automatically repeat on a schedule</p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Recurring Reminder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Recurring Reminder</DialogTitle>
                <DialogDescription>Set up a new reminder that will automatically repeat</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newReminder.name}
                    onChange={(e) => setNewReminder({ ...newReminder, name: e.target.value })}
                    className="col-span-3"
                    placeholder="Annual Performance Review"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="reminderType" className="text-right">
                    Reminder Type
                  </Label>
                  <Select
                    value={newReminder.reminderTypeId}
                    onValueChange={(value) => setNewReminder({ ...newReminder, reminderTypeId: value })}
                  >
                    <SelectTrigger id="reminderType" className="col-span-3">
                      <SelectValue placeholder="Select type" />
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
                  <Label htmlFor="frequency" className="text-right">
                    Frequency
                  </Label>
                  <Select
                    value={newReminder.frequency}
                    onValueChange={(value) => setNewReminder({ ...newReminder, frequency: value })}
                  >
                    <SelectTrigger id="frequency" className="col-span-3">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="interval" className="text-right">
                    Interval
                  </Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    value={newReminder.interval}
                    onChange={(e) => setNewReminder({ ...newReminder, interval: Number.parseInt(e.target.value) || 1 })}
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nextDueDate" className="text-right">
                    First Due Date
                  </Label>
                  <div className="col-span-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="enabled" className="text-right">
                    Enabled
                  </Label>
                  <div className="col-span-3 flex items-center">
                    <Switch
                      id="enabled"
                      checked={newReminder.enabled}
                      onCheckedChange={(checked) => setNewReminder({ ...newReminder, enabled: checked })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateReminder} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recurring Reminders</CardTitle>
            <CardDescription>Reminders that automatically generate based on a schedule</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading recurring reminders...</p>
              </div>
            ) : reminders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell className="font-medium">{reminder.name}</TableCell>
                      <TableCell>{reminder.reminderTypeName}</TableCell>
                      <TableCell>{getFrequencyText(reminder.frequency, reminder.interval)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          {new Date(reminder.nextDueDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={reminder.enabled}
                          onCheckedChange={() => handleToggleEnabled(reminder.id, reminder.enabled)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(reminder)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteReminder(reminder.id)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No recurring reminders</h3>
                <p className="mt-2 text-sm text-center text-muted-foreground">
                  Create recurring reminders to automatically generate new reminders on a schedule
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        {selectedReminder && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Recurring Reminder</DialogTitle>
                <DialogDescription>Update the recurring reminder settings</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="edit-name"
                    value={selectedReminder.name}
                    onChange={(e) => setSelectedReminder({ ...selectedReminder, name: e.target.value })}
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-reminderType" className="text-right">
                    Reminder Type
                  </Label>
                  <Select
                    value={selectedReminder.reminderTypeId}
                    onValueChange={(value) => setSelectedReminder({ ...selectedReminder, reminderTypeId: value })}
                  >
                    <SelectTrigger id="edit-reminderType" className="col-span-3">
                      <SelectValue placeholder="Select type" />
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
                  <Label htmlFor="edit-frequency" className="text-right">
                    Frequency
                  </Label>
                  <Select
                    value={selectedReminder.frequency}
                    onValueChange={(value) => setSelectedReminder({ ...selectedReminder, frequency: value })}
                  >
                    <SelectTrigger id="edit-frequency" className="col-span-3">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-interval" className="text-right">
                    Interval
                  </Label>
                  <Input
                    id="edit-interval"
                    type="number"
                    min="1"
                    value={selectedReminder.interval}
                    onChange={(e) =>
                      setSelectedReminder({ ...selectedReminder, interval: Number.parseInt(e.target.value) || 1 })
                    }
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-nextDueDate" className="text-right">
                    Next Due Date
                  </Label>
                  <div className="col-span-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-enabled" className="text-right">
                    Enabled
                  </Label>
                  <div className="col-span-3 flex items-center">
                    <Switch
                      id="edit-enabled"
                      checked={selectedReminder.enabled}
                      onCheckedChange={(checked) => setSelectedReminder({ ...selectedReminder, enabled: checked })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateReminder} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

