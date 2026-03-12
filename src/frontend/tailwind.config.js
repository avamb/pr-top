/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F8A83',  // Therapy Teal — brand accent
          50: '#F4F7F6',       // Mist
          100: '#E6F5F3',
          200: '#A8C9BE',      // Soft Sage
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#1F8A83',      // Therapy Teal
          600: '#1A7570',
          700: '#163A43',      // Deep Ink
          800: '#134E4A',
          900: '#1C2328',      // Heading Dark
        },
        secondary: '#5E6A71',   // Body Gray
        accent: '#A8C9BE',      // Soft Sage
        background: '#FFFFFF',
        surface: '#F4F7F6',     // Mist
        'warm-sand': '#ECE6DD', // Warm Sand
        text: '#1C2328',        // Heading Dark
        'deep-ink': '#163A43',  // Deep Ink
        border: '#D9E2E0',      // Border Light
        error: '#DC2626',
        success: '#10B981',
        lavender: '#7C7CF4',    // Lavender Signal — AI accent only
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
