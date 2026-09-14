import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // DESIGN.md 调色板
        ink: {
          DEFAULT: '#212121',
          soft: '#75758a',
          muted: '#93939f',
          hairline: '#d9d9dd',
        },
        brand: {
          black: '#000000',
          near: '#17171c',
          green: '#003c33',
          navy: '#071829',
          blue: '#1863dc',
          coral: '#ff7759',
          'coral-soft': '#ffad9b',
        },
        surface: {
          warm: '#eeece7',
          green: '#edfce9',
          blue: '#f1f5ff',
          line: '#f2f2f2',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display-hero': ['clamp(2.75rem, 8vw, 6rem)', {lineHeight: '1', letterSpacing: '-0.04em'}],
        'display-product': ['clamp(2.25rem, 6vw, 4.5rem)', {lineHeight: '1', letterSpacing: '-0.03em'}],
        'section-display': ['clamp(2rem, 5vw, 3.75rem)', {lineHeight: '1', letterSpacing: '-0.02em'}],
        'heading-section': ['clamp(1.75rem, 4vw, 3rem)', {lineHeight: '1.2', letterSpacing: '-0.01em'}],
        'heading-card': ['clamp(1.5rem, 3vw, 2rem)', {lineHeight: '1.2', letterSpacing: '-0.01em'}],
        'heading-feature': ['24px', {lineHeight: '1.3'}],
        'body-lg': ['18px', {lineHeight: '1.4'}],
        body: ['16px', {lineHeight: '1.5'}],
        caption: ['14px', {lineHeight: '1.4'}],
        'mono-label': ['14px', {lineHeight: '1.4', letterSpacing: '0.02em'}],
        micro: ['12px', {lineHeight: '1.4'}],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '22px',
        xl: '30px',
        pill: '32px',
        full: '9999px',
      },
      maxWidth: {
        shell: '1280px',
      },
      keyframes: {
        'accordion-down': {
          from: {height: '0'},
          to: {height: 'var(--radix-accordion-content-height)'},
        },
        'accordion-up': {
          from: {height: 'var(--radix-accordion-content-height)'},
          to: {height: '0'},
        },
        'fade-up': {
          from: {opacity: '0', transform: 'translateY(12px)'},
          to: {opacity: '1', transform: 'translateY(0)'},
        },
        'pulse-soft': {
          '0%, 100%': {opacity: '0.45'},
          '50%': {opacity: '1'},
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.5s ease-out both',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
}
