/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans TC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 12px -4px rgba(44, 26, 18, 0.06), 0 1px 3px -1px rgba(44, 26, 18, 0.04)',
        'elevated': '0 12px 32px -8px rgba(44, 26, 18, 0.14)',
      },
    },
  },
  plugins: [],
};
