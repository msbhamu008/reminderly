"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  getReminderTypes,
  addReminderType,
  updateReminderType,
  deleteReminderType,
  addReminderInterval,
  deleteReminderInterval,
  updateEmailTemplate,
  updateRecipients,
} from "../actions/reminder-actions"
import { useToast } from "@/hooks/use-toast"
import { Bell, Calendar, Check, Clock, Loader2, Mail, Plus, Trash, Users } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  const [reminderTypes, setReminderTypes] = useState<any[]>([])
  const [newTypeName, setNewTypeName] = useState("")
  const [newInterval, setNewInterval] = useState("")
  const [activeReminder, setActiveReminder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const [emailTemplates, setEmailTemplates] = useState<
    Record<
      string,
      {
        subjectTemplate: string
        bodyTemplate: string
      }
    >
  >({})

  const [recipientSettings, setRecipientSettings] = useState<
    Record<
      string,
      {
        notifyEmployee: boolean
        notifyManager: boolean
        notifyHr: boolean
        additionalEmails: string[]
      }
    >
  >({})

  const [newEmail, setNewEmail] = useState<string>("")

  // Load reminder types
  useEffect(() => {
    const fetchReminderTypes = async () => {
      setLoading(true)
      const response = await getReminderTypes()

      if (response.success) {
        setReminderTypes(response.data)
        // Set first reminder type as active
        if (response.data.length > 0 && !activeReminder) {
          setActiveReminder(response.data[0].id)
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to load reminder types",
          variant: "destructive",
        })
      }

      setLoading(false)
    }

    fetchReminderTypes()
  }, [toast, activeReminder])

  // Initialize email templates and recipient settings
  useEffect(() => {
    if (reminderTypes.length > 0) {
      // Initialize email templates with defaults
      const templates: Record<string, { subjectTemplate: string; bodyTemplate: string }> = {}
      const recipients: Record<
        string,
        { notifyEmployee: boolean; notifyManager: boolean; notifyHr: boolean; additionalEmails: string[] }
      > = {}

      reminderTypes.forEach((type) => {
        const name = type.name

        templates[type.id] = {
          subjectTemplate: type.emailTemplate?.subject_template || `[${name}] Reminder for {employee} - Due in {days}`,
          bodyTemplate:
            type.emailTemplate?.body_template ||
            `Dear {recipient},

This is a reminder that {employee}'s ${name} is due on {date} ({days}).

Please take appropriate action before the due date.

Regards,
HR Department`,
        }

        recipients[type.id] = {
          notifyEmployee: type.recipients?.notify_employee ?? true,
          notifyManager: type.recipients?.notify_manager ?? true,
          notifyHr: type.recipients?.notify_hr ?? true,
          additionalEmails: type.recipients?.additional_emails || [],
        }
      })

      setEmailTemplates((prev) => ({ ...prev, ...templates }))
      setRecipientSettings((prev) => ({ ...prev, ...recipients }))
    }
  }, [reminderTypes])

  const handleToggleReminder = (id: string, enabled: boolean) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("name", reminderTypes.find((t) => t.id === id)?.name || "")
      formData.append("enabled", String(enabled))

      const response = await updateReminderType(id, formData)

      if (response.success) {
        setReminderTypes((prev) => prev.map((type) => (type.id === id ? { ...type, enabled } : type)))

        toast({
          title: "Success",
          description: enabled ? "Reminder type enabled" : "Reminder type disabled",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update reminder type",
          variant: "destructive",
        })
      }
    })
  }

  const handleAddReminderType = () => {
    if (!newTypeName.trim()) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append("name", newTypeName)
      formData.append("enabled", "true")

      const response = await addReminderType(formData)

      if (response.success) {
        setReminderTypes((prev) => [
          ...prev,
          {
            id: response.data.id,
            name: response.data.name,
            enabled: response.data.enabled,
            intervals: [30],
          },
        ])

        setActiveReminder(response.data.id)
        setNewTypeName("")

        toast({
          title: "Success",
          description: "Reminder type added successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to add reminder type",
          variant: "destructive",
        })
      }
    })
  }

  const handleDeleteReminderType = (id: string) => {
    if (
      !confirm("Are you sure you want to delete this reminder type? This will also delete all associated reminders.")
    ) {
      return
    }

    startTransition(async () => {
      const response = await deleteReminderType(id)

      if (response.success) {
        setReminderTypes((prev) => prev.filter((type) => type.id !== id))

        if (activeReminder === id) {
          setActiveReminder(reminderTypes.find((type) => type.id !== id)?.id || null)
        }

        toast({
          title: "Success",
          description: "Reminder type deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete reminder type",
          variant: "destructive",
        })
      }
    })
  }

  const handleAddInterval = (typeId: string) => {
    if (!newInterval || isNaN(Number(newInterval))) return

    const daysBeforeValue = Number(newInterval)

    startTransition(async () => {
      const response = await addReminderInterval(typeId, daysBeforeValue)

      if (response.success) {
        setReminderTypes((prev) =>
          prev.map((type) =>
            type.id === typeId
              ? {
                  ...type,
                  intervals: [...type.intervals, daysBeforeValue].sort((a, b) => b - a),
                }
              : type,
          ),
        )

        setNewInterval("")

        toast({
          title: "Success",
          description: "Reminder interval added successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to add reminder interval",
          variant: "destructive",
        })
      }
    })
  }

  const handleDeleteInterval = (typeId: string, daysBeforeValue: number) => {
    startTransition(async () => {
      const response = await deleteReminderInterval(typeId, daysBeforeValue)

      if (response.success) {
        setReminderTypes((prev) =>
          prev.map((type) =>
            type.id === typeId
              ? {
                  ...type,
                  intervals: type.intervals.filter((interval) => interval !== daysBeforeValue),
                }
              : type,
          ),
        )

        toast({
          title: "Success",
          description: "Reminder interval deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete reminder interval",
          variant: "destructive",
        })
      }
    })
  }

  const handleSaveEmailTemplate = (typeId: string) => {
    if (!emailTemplates[typeId]) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append("subject_template", emailTemplates[typeId].subjectTemplate)
      formData.append("body_template", emailTemplates[typeId].bodyTemplate)

      const response = await updateEmailTemplate(typeId, formData)

      if (response.success) {
        toast({
          title: "Success",
          description: "Email template saved successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to save email template",
          variant: "destructive",
        })
      }
    })
  }

  const handleAddEmail = (typeId: string) => {
    if (!newEmail.trim() || !recipientSettings[typeId]) return

    setRecipientSettings((prev) => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        additionalEmails: [...prev[typeId].additionalEmails, newEmail],
      },
    }))

    setNewEmail("")
  }

  const handleRemoveEmail = (typeId: string, email: string) => {
    if (!recipientSettings[typeId]) return

    setRecipientSettings((prev) => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        additionalEmails: prev[typeId].additionalEmails.filter((e) => e !== email),
      },
    }))
  }

  const handleSaveRecipients = (typeId: string) => {
    if (!recipientSettings[typeId]) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append("notify_employee", String(recipientSettings[typeId].notifyEmployee))
      formData.append("notify_manager", String(recipientSettings[typeId].notifyManager))
      formData.append("notify_hr", String(recipientSettings[typeId].notifyHr))
      formData.append("additional_emails", recipientSettings[typeId].additionalEmails.join(","))

      const response = await updateRecipients(typeId, formData)

      if (response.success) {
        toast({
          title: "Success",
          description: "Recipients saved successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to save recipients",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure reminder types, intervals, and notifications</p>
        </div>

        <div className="grid gap-6 md:grid-cols-12">
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle>Reminder Types</CardTitle>
              <CardDescription>Configure the types of reminders you want to track</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {reminderTypes.map((type) => (
                      <div key={type.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant={activeReminder === type.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveReminder(type.id)}
                          >
                            {type.name}
                          </Button>
                          <Badge variant={type.enabled ? "default" : "outline"}>
                            {type.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={type.enabled}
                            onCheckedChange={(checked) => handleToggleReminder(type.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteReminderType(type.id)}
                            className="text-destructive"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="new-type">Add New Type</Label>
                      <Input
                        id="new-type"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="Annual Review"
                      />
                    </div>
                    <Button onClick={handleAddReminderType} disabled={!newTypeName.trim() || isPending}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-8">
            <CardHeader>
              <CardTitle>Reminder Configuration</CardTitle>
              <CardDescription>
                Configure intervals, email templates, and recipients for{" "}
                {reminderTypes.find((t) => t.id === activeReminder)?.name || "selected reminder type"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !activeReminder ? (
                <div className="text-center py-4 text-muted-foreground">
                  Select a reminder type or add a new one to configure it
                </div>
              ) : (
                <Tabs defaultValue="intervals">
                  <TabsList className="mb-4">
                    <TabsTrigger value="intervals">
                      <Clock className="h-4 w-4 mr-2" />
                      Intervals
                    </TabsTrigger>
                    <TabsTrigger value="template">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Template
                    </TabsTrigger>
                    <TabsTrigger value="recipients">
                      <Users className="h-4 w-4 mr-2" />
                      Recipients
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="intervals" className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Reminder Intervals</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure how many days before the due date to send reminders
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {reminderTypes
                        .find((t) => t.id === activeReminder)
                        ?.intervals.map((interval) => (
                          <div key={interval} className="flex items-center gap-1">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {interval === 0 ? "On due date" : `${interval} days before`}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteInterval(activeReminder, interval)}
                              >
                                <Trash className="h-3 w-3" />
                              </Button>
                            </Badge>
                          </div>
                        ))}

                      {reminderTypes.find((t) => t.id === activeReminder)?.intervals.length === 0 && (
                        <div className="text-sm text-muted-foreground">No intervals configured</div>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor="new-interval">Add New Interval (Days Before)</Label>
                        <Input
                          id="new-interval"
                          type="number"
                          min="0"
                          value={newInterval}
                          onChange={(e) => setNewInterval(e.target.value)}
                          placeholder="30"
                        />
                      </div>
                      <Button
                        onClick={() => handleAddInterval(activeReminder)}
                        disabled={!newInterval || isNaN(Number(newInterval)) || isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="template" className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Email Template</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure the email template for this reminder type
                      </p>
                    </div>

                    {emailTemplates[activeReminder] && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="subject-template">Subject Template</Label>
                          <Input
                            id="subject-template"
                            value={emailTemplates[activeReminder].subjectTemplate}
                            onChange={(e) =>
                              setEmailTemplates((prev) => ({
                                ...prev,
                                [activeReminder]: {
                                  ...prev[activeReminder],
                                  subjectTemplate: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="body-template">Body Template</Label>
                          <textarea
                            id="body-template"
                            className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={emailTemplates[activeReminder].bodyTemplate}
                            onChange={(e) =>
                              setEmailTemplates((prev) => ({
                                ...prev,
                                [activeReminder]: {
                                  ...prev[activeReminder],
                                  bodyTemplate: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Available Variables</h4>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>
                              <code>{"{type}"}</code> - The reminder type name
                            </p>
                            <p>
                              <code>{"{employee}"}</code> - The employee's name
                            </p>
                            <p>
                              <code>{"{days}"}</code> - Text describing days remaining (e.g., "in 30 days" or "today")
                            </p>
                            <p>
                              <code>{"{date}"}</code> - The formatted due date
                            </p>
                            <p>
                              <code>{"{recipient}"}</code> - The name of the recipient
                            </p>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleSaveEmailTemplate(activeReminder)}
                          disabled={isPending}
                          className="w-full"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Template"
                          )}
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="recipients" className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Recipients</h3>
                      <p className="text-sm text-muted-foreground">Configure who should receive reminder emails</p>
                    </div>

                    {recipientSettings[activeReminder] && (
                      <>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="notify-employee" className="cursor-pointer">
                              Notify Employee
                            </Label>
                            <Switch
                              id="notify-employee"
                              checked={recipientSettings[activeReminder].notifyEmployee}
                              onCheckedChange={(checked) =>
                                setRecipientSettings((prev) => ({
                                  ...prev,
                                  [activeReminder]: {
                                    ...prev[activeReminder],
                                    notifyEmployee: checked,
                                  },
                                }))
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="notify-manager" className="cursor-pointer">
                              Notify Manager
                            </Label>
                            <Switch
                              id="notify-manager"
                              checked={recipientSettings[activeReminder].notifyManager}
                              onCheckedChange={(checked) =>
                                setRecipientSettings((prev) => ({
                                  ...prev,
                                  [activeReminder]: {
                                    ...prev[activeReminder],
                                    notifyManager: checked,
                                  },
                                }))
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="notify-hr" className="cursor-pointer">
                              Notify HR
                            </Label>
                            <Switch
                              id="notify-hr"
                              checked={recipientSettings[activeReminder].notifyHr}
                              onCheckedChange={(checked) =>
                                setRecipientSettings((prev) => ({
                                  ...prev,
                                  [activeReminder]: {
                                    ...prev[activeReminder],
                                    notifyHr: checked,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label>Additional Email Recipients</Label>
                          <div className="flex flex-wrap gap-2">
                            {recipientSettings[activeReminder].additionalEmails.map((email) => (
                              <Badge key={email} variant="secondary" className="flex items-center gap-1">
                                {email}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 ml-1 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveEmail(activeReminder, email)}
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}

                            {recipientSettings[activeReminder].additionalEmails.length === 0 && (
                              <div className="text-sm text-muted-foreground">No additional recipients</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label htmlFor="new-email">Add Email</Label>
                            <Input
                              id="new-email"
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="additional@example.com"
                            />
                          </div>
                          <Button onClick={() => handleAddEmail(activeReminder)} disabled={!newEmail.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>

                        <Button
                          onClick={() => handleSaveRecipients(activeReminder)}
                          disabled={isPending}
                          className="w-full"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Recipients"
                          )}
                        </Button>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Access other settings pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings/email">
                  <Mail className="mr-2 h-4 w-4" />
                  Email Settings
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings/recurring">
                  <Bell className="mr-2 h-4 w-4" />
                  Recurring Reminders
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings/cron">
                  <Clock className="mr-2 h-4 w-4" />
                  Cron Jobs
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings/email/templates">
                  <Mail className="mr-2 h-4 w-4" />
                  Email Templates
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Current system status and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Email Service</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  <Check className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Cron Jobs</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  <Check className="mr-1 h-3 w-3" />
                  Running
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  <Check className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Reminder Sent</span>
                <span className="text-sm text-muted-foreground">Today, 10:45 AM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Version</span>
                <span className="text-sm text-muted-foreground">1.0.1</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

