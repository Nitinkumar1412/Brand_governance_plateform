/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0c0d12",
        surface: "#14161f",
        "surface-elevated": "#1c1e2b",
        "surface-border": "rgba(255, 255, 255, 0.08)",
        brand: {
          copper: "#d97706",
          amber: "#f59e0b",
          gold: "#e0a96d",
          light: "#faf4eb",
        },
        ink: {
          terminology: "#f43f5e", // Rose for forbidden terms
          facts: "#f59e0b",       // Amber for fact mismatch
          tone: "#818cf8",        // Indigo for tone & voice
        }
      },
      fontFamily: {
        serif: ['"Newsreader"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-copper': '0 0 30px -5px rgba(217, 119, 6, 0.25)',
        'glow-card': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
