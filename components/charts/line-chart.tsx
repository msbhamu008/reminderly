"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"

type LineChartProps = {
  data: { name: string; sent: number; failed: number }[]
}

export function LineChart({ data }: LineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!chartRef.current || !data.length) return

    // Clear previous chart
    chartRef.current.innerHTML = ""

    // Find max value for scaling
    const maxValue = Math.max(...data.map((item) => Math.max(item.sent, item.failed)))

    // Chart dimensions
    const width = chartRef.current.clientWidth
    const height = 300
    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Create SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", `${height}px`)
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)

    // Colors based on theme
    const successColor = "#10b981"
    const failureColor = "#ef4444"
    const textColor = theme === "dark" ? "#e5e7eb" : "#374151"
    const gridColor = theme === "dark" ? "#374151" : "#e5e7eb"

    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + chartHeight - (i * chartHeight) / 5

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
      line.setAttribute("x1", `${padding}`)
      line.setAttribute("y1", `${y}`)
      line.setAttribute("x2", `${width - padding}`)
      line.setAttribute("y2", `${y}`)
      line.setAttribute("stroke", gridColor)
      line.setAttribute("stroke-width", "1")
      line.setAttribute("stroke-opacity", "0.2")
      svg.appendChild(line)

      // Add grid labels
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.setAttribute("x", `${padding - 5}`)
      text.setAttribute("y", `${y + 5}`)
      text.setAttribute("text-anchor", "end")
      text.setAttribute("font-size", "12")
      text.setAttribute("fill", textColor)
      text.textContent = `${Math.round((maxValue * i) / 5)}`
      svg.appendChild(text)
    }

    // Draw x-axis
    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line")
    xAxis.setAttribute("x1", `${padding}`)
    xAxis.setAttribute("y1", `${height - padding}`)
    xAxis.setAttribute("x2", `${width - padding}`)
    xAxis.setAttribute("y2", `${height - padding}`)
    xAxis.setAttribute("stroke", gridColor)
    xAxis.setAttribute("stroke-width", "1")
    svg.appendChild(xAxis)

    // Draw x-axis labels
    data.forEach((item, index) => {
      const x = padding + (index * chartWidth) / (data.length - 1)

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.setAttribute("x", `${x}`)
      text.setAttribute("y", `${height - padding + 20}`)
      text.setAttribute("text-anchor", "middle")
      text.setAttribute("font-size", "12")
      text.setAttribute("fill", textColor)
      text.textContent = item.name
      svg.appendChild(text)
    })

    // Draw success line
    let successPath = `M`
    data.forEach((item, index) => {
      const x = padding + (index * chartWidth) / (data.length - 1)
      const y = padding + chartHeight - (item.sent / maxValue) * chartHeight

      if (index === 0) {
        successPath += ` ${x} ${y}`
      } else {
        successPath += ` L ${x} ${y}`
      }

      // Add data point
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      circle.setAttribute("cx", `${x}`)
      circle.setAttribute("cy", `${y}`)
      circle.setAttribute("r", "4")
      circle.setAttribute("fill", successColor)
      svg.appendChild(circle)

      // Add value
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.setAttribute("x", `${x}`)
      text.setAttribute("y", `${y - 10}`)
      text.setAttribute("text-anchor", "middle")
      text.setAttribute("font-size", "12")
      text.setAttribute("fill", successColor)
      text.textContent = `${item.sent}`
      svg.appendChild(text)
    })

    const successLine = document.createElementNS("http://www.w3.org/2000/svg", "path")
    successLine.setAttribute("d", successPath)
    successLine.setAttribute("fill", "none")
    successLine.setAttribute("stroke", successColor)
    successLine.setAttribute("stroke-width", "2")
    svg.appendChild(successLine)

    // Draw failure line
    let failurePath = `M`
    data.forEach((item, index) => {
      const x = padding + (index * chartWidth) / (data.length - 1)
      const y = padding + chartHeight - (item.failed / maxValue) * chartHeight

      if (index === 0) {
        failurePath += ` ${x} ${y}`
      } else {
        failurePath += ` L ${x} ${y}`
      }

      // Add data point
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      circle.setAttribute("cx", `${x}`)
      circle.setAttribute("cy", `${y}`)
      circle.setAttribute("r", "4")
      circle.setAttribute("fill", failureColor)
      svg.appendChild(circle)

      // Add value
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.setAttribute("x", `${x}`)
      text.setAttribute("y", `${y - 10}`)
      text.setAttribute("text-anchor", "middle")
      text.setAttribute("font-size", "12")
      text.setAttribute("fill", failureColor)
      text.textContent = `${item.failed}`
      svg.appendChild(text)
    })

    const failureLine = document.createElementNS("http://www.w3.org/2000/svg", "path")
    failureLine.setAttribute("d", failurePath)
    failureLine.setAttribute("fill", "none")
    failureLine.setAttribute("stroke", failureColor)
    failureLine.setAttribute("stroke-width", "2")
    svg.appendChild(failureLine)

    // Add legend
    const legendY = padding

    // Success legend
    const successRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    successRect.setAttribute("x", `${width - padding - 100}`)
    successRect.setAttribute("y", `${legendY}`)
    successRect.setAttribute("width", "10")
    successRect.setAttribute("height", "10")
    successRect.setAttribute("fill", successColor)
    svg.appendChild(successRect)

    const successText = document.createElementNS("http://www.w3.org/2000/svg", "text")
    successText.setAttribute("x", `${width - padding - 85}`)
    successText.setAttribute("y", `${legendY + 9}`)
    successText.setAttribute("font-size", "12")
    successText.setAttribute("fill", textColor)
    successText.textContent = "Sent"
    svg.appendChild(successText)

    // Failure legend
    const failureRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    failureRect.setAttribute("x", `${width - padding - 100}`)
    failureRect.setAttribute("y", `${legendY + 20}`)
    failureRect.setAttribute("width", "10")
    failureRect.setAttribute("height", "10")
    failureRect.setAttribute("fill", failureColor)
    svg.appendChild(failureRect)

    const failureText = document.createElementNS("http://www.w3.org/2000/svg", "text")
    failureText.setAttribute("x", `${width - padding - 85}`)
    failureText.setAttribute("y", `${legendY + 29}`)
    failureText.setAttribute("font-size", "12")
    failureText.setAttribute("fill", textColor)
    failureText.textContent = "Failed"
    svg.appendChild(failureText)

    chartRef.current.appendChild(svg)
  }, [data, theme])

  return <div ref={chartRef} className="w-full h-[300px]" />
}

