"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { sendTestEmailWithBrevo } from "@/app/actions/settings-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function TestEmailPage() {
  const [email, setEmail] = useState("")
  const [isSending, startSendingTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null)
  const { toast } = useToast()

  const handleSendTestEmail = () => {
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setTestResult(null)

    startSendingTransition(async () => {
      try {
        const result = await sendTestEmailWithBrevo(email)

        setTestResult({
          success: result.success,
          message: result.message,
        })

        if (result.success) {
          toast({
            title: "Success",
            description: `Test email sent to ${email}`,
          })
        } else {
          toast({
            title: "Failed to Send Email",
            description: result.message || "An error occurred",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error sending test email:", error)
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

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Test Email Delivery</h1>
          <p className="text-muted-foreground">Send a test email to verify your Brevo integration is working</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send Test Email</CardTitle>
            <CardDescription>Enter an email address to receive a test message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="recipient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>{testResult.success ? "Email Sent Successfully" : "Failed to Send Email"}</AlertTitle>
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSendTestEmail} disabled={isSending || !email}>
              {isSending ? "Sending..." : "Send Test Email"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

