#!/usr/bin/env tsx

import { LichtenbergFractalGenerator, createDeterministicOperations, type WorldConstraints, type FractalConfig } from '../src/lib/fractal-generators'
import { writeFileSync } from 'fs'

// Generate Lichtenberg figure data
function generateLichtenbergData() {
  const generator = new LichtenbergFractalGenerator()

  const constraints: WorldConstraints = {
    worldCenter: [0, 0],
    worldRadius: 100,
    maxDepth: 6,
    growthLimit: 80
  }

  const config: FractalConfig = {
    segment_length: 4.0,
    length_variation: 0.3,
    trail_width: 2.0,
    max_depth: 6,
    // Lichtenberg-specific parameters for more organic patterns
    breakdown_probability: 0.7,
    field_strength_decay: 0.15,
    stochastic_factor: 0.8,
    angular_dispersion: Math.PI / 3, // 60 degrees
    preferred_growth_bias: 0.1
  }

  const operations = createDeterministicOperations(42, 1000)

  console.log('🔥 Generating Lichtenberg figure...')
  const segments = generator.generateSegments([0, 0], 0, 'lightning', config, operations, constraints)
  console.log(`⚡ Generated ${segments.length} segments`)

  return segments
}

// Create SVG visualization
function createSVGVisualization(segments: any[]) {
  const padding = 20
  const width = 800
  const height = 600

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  segments.forEach(segment => {
    minX = Math.min(minX, segment.position[0])
    maxX = Math.max(maxX, segment.position[0])
    minY = Math.min(minY, segment.position[1])
    maxY = Math.max(maxY, segment.position[1])
  })

  // Add padding
  const rangeX = maxX - minX
  const rangeY = maxY - minY
  minX -= rangeX * 0.1
  maxX += rangeX * 0.1
  minY -= rangeY * 0.1
  maxY += rangeY * 0.1

  // Scale function
  const scaleX = (x: number) => ((x - minX) / (maxX - minX)) * (width - 2 * padding) + padding
  const scaleY = (y: number) => ((y - minY) / (maxY - minY)) * (height - 2 * padding) + padding

  // Group segments by depth for color coding
  const segmentsByDepth = segments.reduce((acc, segment) => {
    if (!acc[segment.depth]) acc[segment.depth] = []
    acc[segment.depth].push(segment)
    return acc
  }, {} as Record<number, any[]>)

  const maxDepth = Math.max(...segments.map(s => s.depth))

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background for lightning effect -->
  <rect width="${width}" height="${height}" fill="#0a0a0a"/>

  <!-- Title -->
  <text x="${width/2}" y="30" text-anchor="middle" fill="#e0e0e0" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
    Lichtenberg Figure - Electrical Discharge Pattern
  </text>
  <text x="${width/2}" y="50" text-anchor="middle" fill="#888" font-family="Arial, sans-serif" font-size="12">
    Generated with stochastic branching (${segments.length} segments, max depth: ${maxDepth})
  </text>

  <!-- Grid for reference -->
  <defs>
    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#333" stroke-width="0.5" opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>

  <!-- Central point marker -->
  <circle cx="${scaleX(0)}" cy="${scaleY(0)}" r="3" fill="#ff6b6b" opacity="0.8"/>
  <text x="${scaleX(0) + 8}" y="${scaleY(0) - 8}" fill="#ff6b6b" font-family="Arial, sans-serif" font-size="10">Origin</text>
`

  // Draw segments by depth (deepest first, so they appear behind)
  for (let depth = maxDepth; depth >= 0; depth--) {
    const depthSegments = segmentsByDepth[depth] || []

    // Color scheme: bright white/blue core fading to purple at edges
    const intensity = Math.pow((maxDepth - depth) / maxDepth, 0.7)
    const colors = [
      `rgba(255, 255, 255, ${0.9 * intensity})`,      // Depth 0: bright white core
      `rgba(200, 220, 255, ${0.8 * intensity})`,      // Depth 1: light blue
      `rgba(150, 180, 255, ${0.7 * intensity})`,      // Depth 2: blue
      `rgba(120, 140, 255, ${0.6 * intensity})`,      // Depth 3: blue-purple
      `rgba(100, 100, 255, ${0.5 * intensity})`,      // Depth 4: purple
      `rgba(80, 60, 200, ${0.4 * intensity})`,        // Depth 5: dark purple
    ]

    const color = colors[Math.min(depth, colors.length - 1)]
    const strokeWidth = Math.max(0.5, 3 - depth * 0.4) // Thicker strokes for main branches

    svg += `  <!-- Depth ${depth} segments (${depthSegments.length} segments) -->\n`
    svg += `  <g stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.9">\n`

    depthSegments.forEach(segment => {
      const startX = scaleX(segment.position[0] - Math.cos(segment.direction) * segment.length)
      const startY = scaleY(segment.position[1] - Math.sin(segment.direction) * segment.length)
      const endX = scaleX(segment.position[0])
      const endY = scaleY(segment.position[1])

      svg += `    <line x1="${startX.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}"/>\n`
    })

    svg += `  </g>\n`
  }

  // Add glow effect for the main branches
  svg += `  <!-- Glow effect for main branches -->\n`
  svg += `  <g stroke="rgba(255, 255, 255, 0.3)" stroke-width="6" fill="none" opacity="0.6">\n`
  segmentsByDepth[0]?.forEach(segment => {
    const startX = scaleX(segment.position[0] - Math.cos(segment.direction) * segment.length)
    const startY = scaleY(segment.position[1] - Math.sin(segment.direction) * segment.length)
    const endX = scaleX(segment.position[0])
    const endY = scaleY(segment.position[1])

    svg += `    <line x1="${startX.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}"/>\n`
  })
  svg += `  </g>\n`

  // Statistics
  const depthStats = Object.keys(segmentsByDepth).map(depth =>
    `Depth ${depth}: ${segmentsByDepth[parseInt(depth)].length} segments`
  ).join(' | ')

  svg += `
  <!-- Statistics -->
  <text x="20" y="${height - 30}" fill="#666" font-family="Monaco, monospace" font-size="10">
    ${depthStats}
  </text>
  <text x="20" y="${height - 15}" fill="#666" font-family="Monaco, monospace" font-size="10">
    Breakdown probability: 0.7 | Field decay: 0.15 | Stochastic factor: 0.8 | Angular dispersion: 60°
  </text>

</svg>`

  return svg
}

// ASCII visualization for terminal
function createASCIIVisualization(segments: any[]) {
  const width = 80
  const height = 40

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  segments.forEach(segment => {
    minX = Math.min(minX, segment.position[0])
    maxX = Math.max(maxX, segment.position[0])
    minY = Math.min(minY, segment.position[1])
    maxY = Math.max(maxY, segment.position[1])
  })

  // Create grid
  const grid = Array(height).fill(null).map(() => Array(width).fill(' '))

  // Draw segments
  segments.forEach(segment => {
    const x = Math.round(((segment.position[0] - minX) / (maxX - minX)) * (width - 1))
    const y = Math.round(((segment.position[1] - minY) / (maxY - minY)) * (height - 1))

    if (x >= 0 && x < width && y >= 0 && y < height) {
      // Different characters for different depths
      const chars = ['*', '+', '·', '°', '˙', '‧']
      grid[y][x] = chars[Math.min(segment.depth, chars.length - 1)] || '·'
    }
  })

  // Convert to string
  console.log('\n🔥 ASCII Lichtenberg Figure:')
  console.log('─'.repeat(width + 2))
  grid.forEach(row => {
    console.log('│' + row.join('') + '│')
  })
  console.log('─'.repeat(width + 2))
  console.log(`Legend: * = depth 0 (main), + = depth 1, · = depth 2+`)
  console.log(`Total segments: ${segments.length}`)
}

// Main execution
function main() {
  console.log('⚡ Lichtenberg Figure Generator')
  console.log('==============================')

  const segments = generateLichtenbergData()

  // Create ASCII visualization
  createASCIIVisualization(segments)

  // Create SVG file
  const svg = createSVGVisualization(segments)
  const outputFile = 'lichtenberg-figure.html'

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Lichtenberg Figure - Electrical Discharge Pattern</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
            font-family: Arial, sans-serif;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .description {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .code-info {
            font-family: Monaco, monospace;
            font-size: 12px;
            color: #888;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="description">
            <h1>⚡ Lichtenberg Figure - Electrical Discharge Pattern</h1>
            <p>This fractal pattern was generated using our dependency injection system with stochastic branching algorithms that simulate electrical breakdown in materials.</p>

            <h3>Key Features:</h3>
            <ul>
                <li><strong>Stochastic Branching:</strong> Each branch has a probability-based breakdown chance</li>
                <li><strong>Field Strength Decay:</strong> Electrical field weakens with distance, reducing branching</li>
                <li><strong>Angular Dispersion:</strong> Random angular variation creates organic patterns</li>
                <li><strong>Depth-Based Coloring:</strong> Main channels (white) to fine branches (purple)</li>
            </ul>

            <div class="code-info">
                Generated with: breakdown_probability=0.7, field_strength_decay=0.15,
                stochastic_factor=0.8, angular_dispersion=60°, max_depth=6
            </div>
        </div>

        ${svg}
    </div>
</body>
</html>`

  writeFileSync(outputFile, html)
  console.log(`\n💾 SVG visualization saved to: ${outputFile}`)
  console.log(`📖 Open the file in a browser to see the full interactive visualization`)

  // Output some statistics
  const depthCounts = segments.reduce((acc, s) => {
    acc[s.depth] = (acc[s.depth] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  console.log('\n📊 Generation Statistics:')
  Object.keys(depthCounts).forEach(depth => {
    console.log(`   Depth ${depth}: ${depthCounts[parseInt(depth)]} segments`)
  })

  const avgLength = segments.reduce((sum, s) => sum + s.length, 0) / segments.length
  console.log(`   Average segment length: ${avgLength.toFixed(2)}`)
  console.log(`   Total fractal reach: ${Math.sqrt(segments.reduce((max, s) =>
    Math.max(max, s.position[0]**2 + s.position[1]**2), 0)).toFixed(2)} units`)
}

if (require.main === module) {
  main()
}
