"use client"

import { useState, useEffect, useTransition, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { CalendarIcon, CheckCircle, Clock, Loader2, Trash, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  getReminderById,
  updateReminder,
  deleteReminder,
  markReminderAsComplete,
  getReminderTypes,
} from "@/app/actions/reminder-actions"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function ReminderDetailPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params)
  const [reminder, setReminder] = useState<any>(null)
  const [reminderTypes, setReminderTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isCompleting, startCompleteTransition] = useTransition()
  const [date, setDate] = useState<Date>()
  const { toast } = useToast()
  const router = useRouter()

  // Load reminder data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      try {
        // Fetch reminder details using resolvedParams.id
        const reminderResponse = await getReminderById(resolvedParams.id)

        if (reminderResponse.success) {
          setReminder(reminderResponse.data)
          setDate(new Date(reminderResponse.data.dueDate))
        } else {
          toast({
            title: "Error",
            description: "Failed to load reminder details",
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
  }, [resolvedParams.id, toast])

  const handleUpdateReminder = () => {
    if (!reminder || !date) return

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("reminder_type_id", reminder.reminderTypeId)
        formData.append("due_date", date.toISOString().split("T")[0])
        formData.append("notes", reminder.notes || "")

        const response = await updateReminder(resolvedParams.id, formData)

        if (response.success) {
          toast({
            title: "Success",
            description: "Reminder updated successfully",
          })

          // Refresh the reminder data
          const refreshResponse = await getReminderById(resolvedParams.id)
          if (refreshResponse.success) {
            setReminder(refreshResponse.data)
          }
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to update reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error updating reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleDeleteReminder = () => {
    startDeleteTransition(async () => {
      try {
        const response = await deleteReminder(resolvedParams.id)

        if (response.success) {
          toast({
            title: "Success",
            description: "Reminder deleted successfully",
          })

          // Navigate back to reminders list
          router.push("/reminders")
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to delete reminder",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error deleting reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleMarkAsComplete = () => {
    startCompleteTransition(async () => {
      try {
        const response = await markReminderAsComplete(resolvedParams.id)

        if (response.success) {
          // Update local state correctly
          setReminder(prev => ({
            ...prev,
            status: "completed"
          }))

          toast({
            title: "Success",
            description: "Reminder marked as complete",
          })
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to mark reminder as complete",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error completing reminder:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading reminder details...</p>
        </div>
      </div>
    )
  }

  if (!reminder) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Reminder not found</p>
          <Button asChild className="mt-4">
            <Link href="/reminders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reminders
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/reminders">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Link>
              </Button>
              <h1 className="text-3xl font-bold">{reminder.employeeName}'s Reminder</h1>
            </div>
            <p className="text-muted-foreground">Manage reminder details and status</p>
          </div>

          <div className="flex gap-2">
            {reminder.status !== "completed" && (
              <Button variant="outline" onClick={handleMarkAsComplete} disabled={isCompleting}>
                {isCompleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Mark as Complete
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this reminder and remove it from our
                    servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteReminder}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Reminder Details</CardTitle>
              <CardDescription>View and edit reminder information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Status</Label>
                  <Badge
                    variant={
                      reminder.status === "completed" ? "default" : reminder.status === "sent" ? "secondary" : "outline"
                    }
                    className={
                      reminder.status === "completed"
                        ? "bg-green-500"
                        : reminder.status === "sent"
                          ? "bg-blue-500"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                    }
                  >
                    {reminder.status === "completed" ? "Completed" : reminder.status === "sent" ? "Sent" : "Pending"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Employee</Label>
                  <div className="text-right">
                    <p className="font-medium">{reminder.employeeName}</p>
                    <p className="text-sm text-muted-foreground">{reminder.employeeId}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Type</Label>
                  <Select
                    value={reminder.reminderTypeId}
                    onValueChange={(value) => setReminder({ ...reminder, reminderTypeId: value })}
                    disabled={reminder.status === "completed"}
                  >
                    <SelectTrigger className="w-[180px]">
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

                <div className="flex items-center justify-between">
                  <Label>Priority</Label>
                  <Select
                    value={reminder.priority || "medium"}
                    onValueChange={(value) => setReminder({ ...reminder, priority: value })}
                    disabled={reminder.status === "completed"}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                          Low
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                          Medium
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                          High
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Due Date</Label>
                  <div className="grid gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[180px] justify-start text-left font-normal",
                            !date && "text-muted-foreground",
                          )}
                          disabled={reminder.status === "completed"}
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

                <div className="flex items-center justify-between">
                  <Label>Days Remaining</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {reminder.daysRemaining === 0
                        ? "Due today"
                        : reminder.daysRemaining < 0
                          ? `Overdue by ${Math.abs(reminder.daysRemaining)} days`
                          : `${reminder.daysRemaining} days`}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this reminder"
                  value={reminder.notes || ""}
                  onChange={(e) => setReminder({ ...reminder, notes: e.target.value })}
                  disabled={reminder.status === "completed"}
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleUpdateReminder}
                disabled={isPending || reminder.status === "completed"}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reminder History</CardTitle>
              <CardDescription>Email notifications and status changes</CardDescription>
            </CardHeader>
            <CardContent>
              <ReminderHistory reminderId={resolvedParams.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReminderHistory({ reminderId }: { reminderId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)

      try {
        const response = await fetch(`/api/reminders/${reminderId}/logs`)
        const data = await response.json()

        if (data.success) {
          setLogs(data.logs)
        }
      } catch (error) {
        console.error("Error fetching reminder logs:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [reminderId])

  if (loading) {
    return (
      <div className="text-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading history...</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No history available for this reminder</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
          <div
            className={cn(
              "rounded-full p-1",
              log.status === "sent"
                ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                : log.status === "completed"
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
            )}
          >
            {log.status === "sent" ? (
              <CheckCircle className="h-4 w-4" />
            ) : log.status === "completed" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Trash className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {log.status === "sent"
                ? "Reminder email sent"
                : log.status === "completed"
                  ? "Marked as complete"
                  : "Reminder failed"}
            </p>
            {log.status === "sent" && (
              <p className="text-sm text-muted-foreground">Sent to {log.recipients?.length || 0} recipients</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

