/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          purple: '#8B5CF6',
          pink: '#EC4899',
        },
        accent: {
          gold: '#FBBF24',
        },
        festive: {
          cream: '#FFF8F0',
          pastel: '#FDF2F8',
        },
        // F2H Retail Standard (Updated to Green #388e3c)
        brand: {
          blue: '#388e3c',
          dark: '#2e7d32',
          red: '#ee2e24',
          slate: '#0f172a',
          light: '#f8fafc',
          glass: 'rgba(255, 255, 255, 0.7)',
        },
        'deep-blue': '#2e7d32',
        'fresh-blue': '#388e3c',
        'brand-green': '#388e3c',
        'fresh-green': '#388e3c',
        'deep-green': '#2e7d32',
        slate: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          400: '#94a3b8',
          50: '#f8fafc',
        }
      },
      fontFamily: {
        jakarta: ['var(--font-plus-jakarta)', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        'mega': '32px',
        'retail': '40px',
      },
      boxShadow: {
        'retail': '0 20px 50px rgba(0, 0, 0, 0.05)',
        'blue-glow': '0 0 40px rgba(56, 142, 60, 0.15)',
        'green-glow': '0 0 40px rgba(56, 142, 60, 0.15)',
      },
      backgroundImage: {
        'retail-gradient': 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)',
        'gradient-blue': 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)',
        'gradient-green': 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)',
      },
    },
  },
  plugins: [],
}

