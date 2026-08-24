/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        taga: {
          navy: '#0a1128',
          blue: '#0005D6',
          green: '#36AB52',
          mango: '#F97316',
        },
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
