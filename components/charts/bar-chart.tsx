"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"

type BarChartProps = {
  data: { name: string; value: number }[]
}

export function BarChart({ data }: BarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!chartRef.current || !data.length) return

    // Clear previous chart
    chartRef.current.innerHTML = ""

    // Find max value for scaling
    const maxValue = Math.max(...data.map((item) => item.value))

    // Chart dimensions
    const width = chartRef.current.clientWidth
    const height = 300
    const barPadding = 0.2
    const barWidth = width / data.length

    // Create SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", `${height}px`)
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)

    // Colors based on theme
    const barColor = theme === "dark" ? "#3b82f6" : "#2563eb"
    const textColor = theme === "dark" ? "#e5e7eb" : "#374151"
    const gridColor = theme === "dark" ? "#374151" : "#e5e7eb"

    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
      const y = height - (i * height) / 5

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
      line.setAttribute("x1", "0")
      line.setAttribute("y1", `${y}`)
      line.setAttribute("x2", `${width}`)
      line.setAttribute("y2", `${y}`)
      line.setAttribute("stroke", gridColor)
      line.setAttribute("stroke-width", "1")
      line.setAttribute("stroke-opacity", "0.2")
      svg.appendChild(line)

      // Add grid labels
      if (i > 0) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", "5")
        text.setAttribute("y", `${y - 5}`)
        text.setAttribute("font-size", "12")
        text.setAttribute("fill", textColor)
        text.textContent = `${Math.round((maxValue * i) / 5)}`
        svg.appendChild(text)
      }
    }

    // Draw bars
    data.forEach((item, index) => {
      const barHeight = (item.value / maxValue) * height * 0.9
      const x = index * barWidth
      const y = height - barHeight

      const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect")
      bar.setAttribute("x", `${x + (barWidth * barPadding) / 2}`)
      bar.setAttribute("y", `${y}`)
      bar.setAttribute("width", `${barWidth * (1 - barPadding)}`)
      bar.setAttribute("height", `${barHeight}`)
      bar.setAttribute("fill", barColor)
      bar.setAttribute("rx", "4")
      svg.appendChild(bar)

      // Add label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      text.setAttribute("x", `${x + barWidth / 2}`)
      text.setAttribute("y", `${height - 5}`)
      text.setAttribute("text-anchor", "middle")
      text.setAttribute("font-size", "12")
      text.setAttribute("fill", textColor)
      text.textContent = item.name
      svg.appendChild(text)

      // Add value
      const valueText = document.createElementNS("http://www.w3.org/2000/svg", "text")
      valueText.setAttribute("x", `${x + barWidth / 2}`)
      valueText.setAttribute("y", `${y - 5}`)
      valueText.setAttribute("text-anchor", "middle")
      valueText.setAttribute("font-size", "12")
      valueText.setAttribute("fill", textColor)
      valueText.textContent = `${item.value}`
      svg.appendChild(valueText)
    })

    chartRef.current.appendChild(svg)
  }, [data, theme])

  return <div ref={chartRef} className="w-full h-[300px]" />
}

