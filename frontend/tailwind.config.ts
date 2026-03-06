import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#06080f',
        s1: '#0d1117',
        s2: '#161b22',
        s3: '#21262d',
        s4: '#30363d',
        border: '#30363d',
        text: '#e6edf3',
        dim: '#8b949e',
        dim2: '#6e7681',
        accent: '#58a6ff',
        accent2: '#1f6feb',
        green: '#3fb950',
        red: '#f85149',
        orange: '#d29922',
        purple: '#bc8cff',
        cyan: '#39d2c0',
        pink: '#f778ba',
        yellow: '#e3b341',
      },
    },
  },
  plugins: [],
}
export default config
