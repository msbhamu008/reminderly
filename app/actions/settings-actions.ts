"use server"

type BrevoSettings = {
  apiKey?: string
  fromEmail: string
  fromName: string
}

export async function getBrevoSettings() {
  try {
    // Return the current environment variables
    return {
      success: true,
      data: {
        apiKey: process.env.BREVO_API_KEY ? "exists" : "",
        fromEmail: process.env.EMAIL_FROM || "",
        fromName: process.env.EMAIL_FROM_NAME || "Employee Reminder System",
      },
    }
  } catch (error) {
    console.error("Error getting Brevo settings:", error)
    return { success: false, message: (error as Error).message }
  }
}

export async function testBrevoSettings(settings: BrevoSettings) {
  try {
    // Use the provided API key or fall back to the environment variable
    const apiKey = settings.apiKey || process.env.BREVO_API_KEY

    if (!apiKey) {
      return { success: false, message: "API key is required" }
    }

    if (!settings.fromEmail) {
      return { success: false, message: "From email is required" }
    }

    // Test the API by making a simple request to get account information
    const response = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "api-key": process.env.BREVO_API_KEY || '',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        message: data.message || `API Error: ${response.status} ${response.statusText}`,
      }
    }

    // If we get here, the API key is valid
    return {
      success: true,
      message: `Successfully connected to Brevo API. Account: ${data.email || data.firstName || "Unknown"}`,
    }
  } catch (error) {
    console.error("Brevo API test failed:", error)
    return {
      success: false,
      message: `Connection failed: ${(error as Error).message}`,
    }
  }
}

export async function saveBrevoSettings(settings: BrevoSettings) {
  try {
    // In a real application, you would update environment variables or store in a database
    // For this demo, we'll just log the settings
    console.log("Brevo settings saved:", {
      ...settings,
      apiKey: settings.apiKey ? "********" : undefined,
    })

    // In a real application, you would update the environment variables here
    // For now, we'll just return success

    return {
      success: true,
      message: "Brevo settings saved successfully. Note: In this demo, settings are not permanently stored.",
    }
  } catch (error) {
    console.error("Error saving Brevo settings:", error)
    return { success: false, message: (error as Error).message }
  }
}

export async function sendTestEmailWithBrevo(to: string) {
  try {
    const apiKey = process.env.BREVO_API_KEY
    const fromEmail = process.env.EMAIL_FROM || "noreply@example.com"
    const fromName = process.env.EMAIL_FROM_NAME || "Employee Reminder System"

    if (!apiKey) {
      return { success: false, message: "Brevo API key is not configured" }
    }

    // Prepare the request payload for Brevo
    const payload = {
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email: to }],
      subject: "Test Email from Employee Reminder System",
      htmlContent: `
        <h1>Test Email</h1>
        <p>This is a test email from your Employee Reminder System using Brevo.</p>
        <p>If you received this email, your Brevo configuration is working correctly.</p>
        <p>Time sent: ${new Date().toLocaleString()}</p>
      `,
    }

    // Send the email using Brevo API
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY || '',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        message: result.message || `Failed to send test email: ${response.status} ${response.statusText}`,
      }
    }

    return {
      success: true,
      message: `Test email sent successfully to ${to}. Message ID: ${result.messageId || "Unknown"}`,
    }
  } catch (error) {
    console.error("Error sending test email:", error)
    return {
      success: false,
      message: `Failed to send test email: ${(error as Error).message}`,
    }
  }
}

