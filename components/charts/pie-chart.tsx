"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"

type PieChartProps = {
  data: { name: string; value: number }[]
}

export function PieChart({ data }: PieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!chartRef.current || !data.length) return

    // Clear previous chart
    chartRef.current.innerHTML = ""

    // Chart dimensions
    const width = chartRef.current.clientWidth
    const height = 300
    const radius = (Math.min(width, height) / 2) * 0.8
    const centerX = width / 2
    const centerY = height / 2

    // Create SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", `${height}px`)
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)

    // Colors based on theme
    const textColor = theme === "dark" ? "#e5e7eb" : "#374151"

    // Color palette
    const colors = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#6366f1",
      "#14b8a6",
      "#f97316",
      "#8b5cf6",
    ]

    // Calculate total value
    const total = data.reduce((sum, item) => sum + item.value, 0)

    // Draw pie slices
    let startAngle = 0

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI
      const endAngle = startAngle + sliceAngle

      // Calculate path
      const x1 = centerX + radius * Math.cos(startAngle)
      const y1 = centerY + radius * Math.sin(startAngle)
      const x2 = centerX + radius * Math.cos(endAngle)
      const y2 = centerY + radius * Math.sin(endAngle)

      // Create path for slice
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0

      path.setAttribute(
        "d",
        `
        M ${centerX} ${centerY}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `,
      )
      path.setAttribute("fill", colors[index % colors.length])
      svg.appendChild(path)

      // Add label
      const labelAngle = startAngle + sliceAngle / 2
      const labelRadius = radius * 0.7
      const labelX = centerX + labelRadius * Math.cos(labelAngle)
      const labelY = centerY + labelRadius * Math.sin(labelAngle)

      const percentage = Math.round((item.value / total) * 100)
      if (percentage >= 5) {
        // Only show label if slice is big enough
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", `${labelX}`)
        text.setAttribute("y", `${labelY}`)
        text.setAttribute("text-anchor", "middle")
        text.setAttribute("dominant-baseline", "middle")
        text.setAttribute("font-size", "12")
        text.setAttribute("fill", "white")
        text.textContent = `${percentage}%`
        svg.appendChild(text)
      }

      startAngle = endAngle
    })

    // Add legend
    const legendY = height - data.length * 20

    data.forEach((item, index) => {
      const y = legendY + index * 20

      // Legend color box
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
      rect.setAttribute("x", "10")
      rect.setAttribute("y", `${y}`)
      rect.setAttribute("width", "10")
      rect.setAttribute("height", "10")
      rect.setAttribute("fill", colors[index % colors.length])
      svg.appendChild(rect)

      // Legend text
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.setAttribute("x", "25")
      text.setAttribute("y", `${y + 9}`)
      text.setAttribute("font-size", "12")
      text.setAttribute("fill", textColor)
      text.textContent = `${item.name} (${item.value})`
      svg.appendChild(text)
    })

    chartRef.current.appendChild(svg)
  }, [data, theme])

  return <div ref={chartRef} className="w-full h-[300px]" />
}

