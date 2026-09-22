/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fintech: {
          bg: '#0B0F19',
          card: '#111827',
          cardHover: '#1F2937',
          border: '#1E293B',
          accent: '#3B82F6',
          profit: '#10B981',
          loss: '#EF4444',
          warning: '#F59E0B',
          textMuted: '#94A3B8',
        }
      }
    },
  },
  plugins: [],
}
