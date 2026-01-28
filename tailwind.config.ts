import type { Config } from "tailwindcss"

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Teamy Brand Colors - Balanced Palette
      colors: {
        // Brand colors
        teamy: {
          primary: '#0056C7',
          'primary-dark': '#003A8C',
          'primary-soft': '#1A6FEA',
          'primary-light': '#3B82F6',
          accent: '#6FD6FF',
          'accent-dark': '#0EA5E9',
        },
        // Sidebar
        sidebar: {
          DEFAULT: '#0C1222',
          hover: '#1A2440',
          active: '#1E2A4A',
        },
        // Semantic colors via CSS variables
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Font families
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        heading: ['Nunito', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        logo: ['Quicksand', 'Nunito', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // Border radius
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      // Box shadows
      boxShadow: {
        'teamy-glow': '0 0 20px rgba(111, 214, 255, 0.4)',
        'teamy-glow-sm': '0 0 12px rgba(111, 214, 255, 0.3)',
        'teamy-glow-lg': '0 0 30px rgba(111, 214, 255, 0.5)',
        'card': '0 10px 30px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 20px 40px rgba(0, 0, 0, 0.12)',
        'nav': '0 4px 20px rgba(0, 0, 0, 0.1)',
      },
      // Keyframes
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
