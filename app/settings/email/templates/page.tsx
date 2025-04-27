"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getReminderTypes, updateEmailTemplate } from "@/app/actions/reminder-actions"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, CheckCircle, Eye } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function EmailTemplatesPage() {
  const [reminderTypes, setReminderTypes] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState<string>("")
  const [template, setTemplate] = useState({
    subject: "",
    body: "",
  })
  const [previewData, setPreviewData] = useState({
    type: "Certification Renewal",
    employee: "John Doe",
    days: "in 30 days",
    date: "April 30, 2025",
    recipient: "HR Manager",
  })
  const [previewSubject, setPreviewSubject] = useState("")
  const [previewBody, setPreviewBody] = useState("")
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [saveResult, setSaveResult] = useState<{ success: boolean; message?: string } | null>(null)
  const { toast } = useToast()

  // Load reminder types
  useEffect(() => {
    const fetchReminderTypes = async () => {
      setLoading(true)
      const response = await getReminderTypes()

      if (response.success) {
        setReminderTypes(response.data)
        if (response.data.length > 0 && !selectedType) {
          setSelectedType(response.data[0].id)
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
  }, [toast, selectedType])

  // Load template when type changes
  useEffect(() => {
    if (selectedType && reminderTypes.length > 0) {
      const selectedReminderType = reminderTypes.find((type) => type.id === selectedType)
      if (selectedReminderType && selectedReminderType.emailTemplate) {
        setTemplate({
          subject: selectedReminderType.emailTemplate.subject_template || "",
          body: selectedReminderType.emailTemplate.body_template || "",
        })
      }
    }
  }, [selectedType, reminderTypes])

  // Update preview when template or preview data changes
  useEffect(() => {
    let subject = template.subject
    let body = template.body

    // Replace all variables in the template
    Object.entries(previewData).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g')
      subject = subject.replace(regex, value || '')
      body = body.replace(regex, value || '')
    })

    setPreviewSubject(subject)
    setPreviewBody(body)
  }, [template, previewData])

  const handleInputChange = (field: string, value: string) => {
    setTemplate((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePreviewDataChange = (field: string, value: string) => {
    setPreviewData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveTemplate = () => {
    setSaveResult(null)

    if (!selectedType) {
      toast({
        title: "Error",
        description: "No reminder type selected",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append("subject_template", template.subject)
      formData.append("body_template", template.body)

      const response = await updateEmailTemplate(selectedType, formData)

      if (response.success) {
        setSaveResult({
          success: true,
          message: "Email template saved successfully",
        })

        toast({
          title: "Success",
          description: "Email template saved successfully",
        })
      } else {
        setSaveResult({
          success: false,
          message: response.error || "Failed to save email template",
        })

        toast({
          title: "Error",
          description: response.error || "Failed to save email template",
          variant: "destructive",
        })
      }
    })
  }

  // Helper function to replace template variables
  function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, "g"), value)
    }
    return result
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">Customize email templates for different reminder types</p>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-12">
            <Card className="md:col-span-4">
              <CardHeader>
                <CardTitle>Reminder Types</CardTitle>
                <CardDescription>Select a reminder type to edit its template</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
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
              </CardContent>
            </Card>

            <Card className="md:col-span-8">
              <CardHeader>
                <CardTitle>Email Template Editor</CardTitle>
                <CardDescription>
                  Customize the email template for{" "}
                  {reminderTypes.find((t) => t.id === selectedType)?.name || "selected reminder type"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="editor">
                  <TabsList className="mb-4">
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="variables">Variables</TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Email Subject</Label>
                      <Input
                        id="subject"
                        value={template.subject}
                        onChange={(e) => handleInputChange("subject", e.target.value)}
                        placeholder="Enter subject with variables like: {type} Reminder for {employee}"
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="body">Email Body</Label>
                      <div className="border rounded-md bg-muted/5">
                        <textarea
                          id="body"
                          value={template.body}
                          onChange={(e) => handleInputChange("body", e.target.value)}
                          className="min-h-[300px] w-full rounded-md border-0 bg-transparent p-3 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none"
                          placeholder={`Dear {recipient},

This is a reminder that {employee}'s {type} is due {days} ({date}).

Please take appropriate action before the due date.

Best regards,
HR Department`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>💡</span>
                        <span>Use variables like {"{employee}"}, {"{type}"}, {"{days}"}, {"{date}"}, {"{recipient}"} - Check Variables tab for more info</span>
                      </p>
                    </div>

                    {saveResult && (
                      <Alert variant={saveResult.success ? "default" : "destructive"}>
                        {saveResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <AlertTitle>{saveResult.success ? "Template Saved" : "Error"}</AlertTitle>
                        <AlertDescription>{saveResult.message}</AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Preview Settings</h3>
                        <p className="text-sm text-muted-foreground">
                          Customize the preview data to see how your email will look
                        </p>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="previewEmployee">Employee Name</Label>
                            <Input
                              id="previewEmployee"
                              value={previewData.employee}
                              onChange={(e) => handlePreviewDataChange("employee", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previewType">Reminder Type</Label>
                            <Input
                              id="previewType"
                              value={previewData.type}
                              onChange={(e) => handlePreviewDataChange("type", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previewDays">Days Text</Label>
                            <Input
                              id="previewDays"
                              value={previewData.days}
                              onChange={(e) => handlePreviewDataChange("days", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previewDate">Due Date</Label>
                            <Input
                              id="previewDate"
                              value={previewData.date}
                              onChange={(e) => handlePreviewDataChange("date", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previewRecipient">Recipient</Label>
                            <Input
                              id="previewRecipient"
                              value={previewData.recipient}
                              onChange={(e) => handlePreviewDataChange("recipient", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-medium">Email Preview</h3>
                        </div>

                        <div className="border rounded-md p-6 space-y-4 bg-card">
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground font-medium">Subject:</p>
                            <p className="text-base">{previewSubject || "No subject"}</p>
                          </div>

                          <Separator />

                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground font-medium">Body:</p>
                            <div
                              className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: previewBody.replace(/\n/g, "<br/>") }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="variables">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Use these variables in your email templates to insert dynamic content:
                      </p>

                      <div className="border rounded-md divide-y">
                        <div className="grid grid-cols-2 p-3">
                          <div className="font-medium">Variable</div>
                          <div className="font-medium">Description</div>
                        </div>
                        <div className="grid grid-cols-2 p-3">
                          <div>
                            <code>{"{type}"}</code>
                          </div>
                          <div>The reminder type name</div>
                        </div>
                        <div className="grid grid-cols-2 p-3">
                          <div>
                            <code>{"{employee}"}</code>
                          </div>
                          <div>The employee's name</div>
                        </div>
                        <div className="grid grid-cols-2 p-3">
                          <div>
                            <code>{"{days}"}</code>
                          </div>
                          <div>Text describing days remaining (e.g., "in 30 days" or "today")</div>
                        </div>
                        <div className="grid grid-cols-2 p-3">
                          <div>
                            <code>{"{date}"}</code>
                          </div>
                          <div>The formatted due date</div>
                        </div>
                        <div className="grid grid-cols-2 p-3">
                          <div>
                            <code>{"{recipient}"}</code>
                          </div>
                          <div>The name of the recipient</div>
                        </div>
                      </div>

                      <div className="bg-muted p-3 rounded-md">
                        <h4 className="font-medium mb-2">Example:</h4>
                        <p className="text-sm">
                          Dear {"{recipient}"},<br />
                          <br />
                          This is a reminder that {"{employee}"}'s {"{type}"} is due {"{days}"} on {"{date}"}.<br />
                          <br />
                          Please take appropriate action before the due date.
                          <br />
                          <br />
                          Regards,
                          <br />
                          HR Department
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveTemplate} disabled={isPending || !selectedType}>
                  {isPending ? "Saving..." : "Save Template"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

