/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gruvbox': {
          // Gruvbox Dark Material theme colors
          'bg-hard': '#1d2021',        // Hard background
          'bg': '#282828',             // Medium background
          'bg-soft': '#32302f',        // Soft background
          'bg1': '#3c3836',            // Background 1
          'bg2': '#504945',            // Background 2
          'bg3': '#665c54',            // Background 3
          'bg4': '#7c6f64',            // Background 4
          'fg0': '#fbf1c7',            // Foreground 0 (brightest)
          'fg1': '#ebdbb2',            // Foreground 1
          'fg2': '#d5c4a1',            // Foreground 2
          'fg3': '#bdae93',            // Foreground 3
          'fg4': '#a89984',            // Foreground 4 (dimmer)
          'red': '#cc241d',            // Red
          'red-bright': '#fb4934',     // Bright red
          'green': '#98971a',          // Green
          'green-bright': '#b8bb26',   // Bright green
          'yellow': '#d79921',         // Yellow
          'yellow-bright': '#fabd2f',  // Bright yellow
          'blue': '#458588',           // Blue
          'blue-bright': '#83a598',    // Bright blue
          'purple': '#b16286',         // Purple
          'purple-bright': '#d3869b',  // Bright purple
          'aqua': '#689d6a',           // Aqua
          'aqua-bright': '#8ec07c',    // Bright aqua
          'orange': '#d65d0e',         // Orange
          'orange-bright': '#fe8019',  // Bright orange
          'gray': '#928374',           // Gray
          'gray-bright': '#a89984',    // Bright gray
        },
        // Semantic color aliases for easier use
        'primary': '#458588',          // Blue
        'primary-hover': '#83a598',    // Bright blue
        'secondary': '#665c54',        // Background 3
        'secondary-hover': '#7c6f64',  // Background 4
        'accent': '#b8bb26',           // Bright green
        'accent-hover': '#98971a',     // Green
        'danger': '#cc241d',           // Red
        'danger-hover': '#fb4934',     // Bright red
        'warning': '#fabd2f',          // Bright yellow
        'info': '#83a598',             // Bright blue
        'success': '#b8bb26',          // Bright green
        'background': '#282828',       // Medium background
        'surface': '#3c3836',          // Background 1
        'text': '#ebdbb2',             // Foreground 1
        'text-dim': '#a89984',         // Foreground 4
        'text-bright': '#fbf1c7',      // Foreground 0
        'border': '#504945',           // Background 2
      },
      fontFamily: {
        'serif': ['Zilla Slab', 'serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}
