"use client"

import type React from "react"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { testBrevoSettings, saveBrevoSettings, getBrevoSettings } from "@/app/actions/settings-actions"
import { useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState({
    apiKey: "",
    fromEmail: "",
    fromName: "Employee Reminder System",
  })

  const [loading, setLoading] = useState(true)
  const [isTesting, startTestTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null)
  const { toast } = useToast()

  // Load existing settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const response = await getBrevoSettings()

        if (response.success) {
          setSettings({
            apiKey: response.data.apiKey ? "••••••••••••••••••••••••••••••••" : "",
            fromEmail: response.data.fromEmail || "",
            fromName: response.data.fromName || "Employee Reminder System",
          })
        }
      } catch (error) {
        console.error("Error loading Brevo settings:", error)
        toast({
          title: "Error",
          description: "Failed to load Brevo settings",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [toast])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleTestConnection = () => {
    setTestResult(null)

    startTestTransition(async () => {
      try {
        // Don't send the API key if it's masked
        const testSettings = {
          ...settings,
          apiKey: settings.apiKey.includes("•") ? undefined : settings.apiKey,
        }

        const result = await testBrevoSettings(testSettings)

        setTestResult({
          success: result.success,
          message: result.message,
        })

        if (result.success) {
          toast({
            title: "Success",
            description: "Brevo API connection test successful",
          })
        } else {
          toast({
            title: "Connection Failed",
            description: result.message || "Failed to connect to Brevo API",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error testing Brevo connection:", error)
        setTestResult({
          success: false,
          message: (error as Error).message,
        })

        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const handleSaveSettings = () => {
    startSaveTransition(async () => {
      try {
        // Don't send the API key if it's masked
        const saveData = {
          ...settings,
          apiKey: settings.apiKey.includes("•") ? undefined : settings.apiKey,
        }

        const result = await saveBrevoSettings(saveData)

        if (result.success) {
          toast({
            title: "Success",
            description: "Brevo settings saved successfully",
          })

          // Mask the API key after saving
          if (settings.apiKey && !settings.apiKey.includes("•")) {
            setSettings((prev) => ({
              ...prev,
              apiKey: "••••••••••••••••••••••••••••••••",
            }))
          }
        } else {
          toast({
            title: "Error",
            description: result.message || "Failed to save Brevo settings",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error saving Brevo settings:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Email Settings</h1>
          <p className="text-muted-foreground">Configure Brevo (formerly Sendinblue) for sending email reminders</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Brevo API Configuration</CardTitle>
            <CardDescription>Set up your Brevo API credentials for sending emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-4">Loading settings...</div>
            ) : (
              <>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">Brevo API Key</Label>
                    <Input
                      id="apiKey"
                      name="apiKey"
                      placeholder="xkeysib-..."
                      value={settings.apiKey}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      You can find your API key in your Brevo account under SMTP & API &gt; API Keys
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fromEmail">From Email Address</Label>
                    <Input
                      id="fromEmail"
                      name="fromEmail"
                      placeholder="noreply@yourcompany.com"
                      value={settings.fromEmail}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the email address that will appear as the sender of reminder emails
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fromName">From Name</Label>
                    <Input
                      id="fromName"
                      name="fromName"
                      placeholder="Employee Reminder System"
                      value={settings.fromName}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the name that will appear as the sender of reminder emails
                    </p>
                  </div>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{testResult.success ? "Connection Successful" : "Connection Failed"}</AlertTitle>
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={loading || isTesting || isSaving || !settings.apiKey || !settings.fromEmail}
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={loading || isTesting || isSaving || !settings.apiKey || !settings.fromEmail}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Brevo</CardTitle>
            <CardDescription>Information about using Brevo for email delivery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">What is Brevo?</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Brevo (formerly Sendinblue) is an email marketing service that provides reliable email delivery for
                  transactional and marketing emails. It offers a free tier that allows sending up to 300 emails per
                  day.
                </p>
              </div>

              <div>
                <h3 className="font-medium">Getting Started with Brevo</h3>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground mt-2 space-y-1">
                  <li>
                    Create a free account at{" "}
                    <a href="https://www.brevo.com" target="_blank" rel="noopener noreferrer" className="text-primary">
                      Brevo.com
                    </a>
                  </li>
                  <li>Verify your account and domain</li>
                  <li>Navigate to SMTP & API &gt; API Keys</li>
                  <li>Create a new API key with appropriate permissions</li>
                  <li>Copy the API key and paste it in the field above</li>
                </ol>
              </div>

              <div>
                <h3 className="font-medium">Benefits of Using Brevo</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground mt-2 space-y-1">
                  <li>High deliverability rates</li>
                  <li>No need to configure SMTP servers</li>
                  <li>Email tracking and analytics</li>
                  <li>Free tier available for small businesses</li>
                  <li>Reliable service with good support</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

