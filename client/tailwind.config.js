import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        // Colorblind-friendly argument type colors
        'arg-for': {
          DEFAULT: "hsl(var(--argument-for))",
          bg: "hsl(var(--argument-for-bg))",
          border: "hsl(var(--argument-for-border))",
          text: "hsl(var(--argument-for-text))",
          'badge-bg': "hsl(var(--argument-for-badge-bg))",
          'badge-text': "hsl(var(--argument-for-badge-text))",
        },
        'arg-against': {
          DEFAULT: "hsl(var(--argument-against))",
          bg: "hsl(var(--argument-against-bg))",
          border: "hsl(var(--argument-against-border))",
          text: "hsl(var(--argument-against-text))",
          'badge-bg': "hsl(var(--argument-against-badge-bg))",
          'badge-text': "hsl(var(--argument-against-badge-text))",
        },
        'arg-clarify': {
          DEFAULT: "hsl(var(--argument-clarify))",
          bg: "hsl(var(--argument-clarify-bg))",
          border: "hsl(var(--argument-clarify-border))",
          text: "hsl(var(--argument-clarify-text))",
          'badge-bg': "hsl(var(--argument-clarify-badge-bg))",
          'badge-text': "hsl(var(--argument-clarify-badge-text))",
        },
        // Vote colors
        'vote-success': {
          DEFAULT: "hsl(var(--vote-success))",
          bg: "hsl(var(--vote-success-bg))",
        },
        'vote-uncertain': {
          DEFAULT: "hsl(var(--vote-uncertain))",
          bg: "hsl(var(--vote-uncertain-bg))",
        },
        'vote-failure': {
          DEFAULT: "hsl(var(--vote-failure))",
          bg: "hsl(var(--vote-failure-bg))",
        },
        // Result colors
        'result-triumph': {
          DEFAULT: "hsl(var(--result-triumph))",
          bg: "hsl(var(--result-triumph-bg))",
          text: "hsl(var(--result-triumph-text))",
        },
        'result-success-but': {
          DEFAULT: "hsl(var(--result-success-but))",
          bg: "hsl(var(--result-success-but-bg))",
          text: "hsl(var(--result-success-but-text))",
        },
        'result-failure-but': {
          DEFAULT: "hsl(var(--result-failure-but))",
          bg: "hsl(var(--result-failure-but-bg))",
          text: "hsl(var(--result-failure-but-text))",
        },
        'result-disaster': {
          DEFAULT: "hsl(var(--result-disaster))",
          bg: "hsl(var(--result-disaster-bg))",
          text: "hsl(var(--result-disaster-text))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    typography,
  ],
}
