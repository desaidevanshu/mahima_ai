/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'Arial', 'sans-serif'],
        body: ['DM Sans', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        brutal: '5px 5px 0 #171717',
        'brutal-sm': '3px 3px 0 #171717',
      },
    },
  },
  plugins: [],
}
