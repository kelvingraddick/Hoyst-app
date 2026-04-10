/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          dark: '#0B0B0C',
          light: '#FFFFFF',
        },
        surface: {
          dark: '#141519',
          light: '#F8F8F8',
        },
        ink: {
          dark: '#F8F8F8',
          light: '#1F2933',
        },
        muted: '#9CA3AF',
        brand: {
          green: '#3BAF4A',
          orange: '#FF8A3D',
          red: '#E5483D',
          purple: '#8B6CFF',
          blue: '#68B8E8',
          charcoal: '#1F2933',
        },
      },
      borderRadius: {
        card: '24px',
        pill: '999px',
      },
      spacing: {
        18: '18px',
        28: '28px',
      },
    },
  },
  plugins: [],
};
