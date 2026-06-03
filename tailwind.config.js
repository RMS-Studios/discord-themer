/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: "#36393f",
          sidebar: "#2f3136",
          dark: "#202225",
          blurple: "#5865f2",
          green: "#3ba55d",
        },
      },
    },
  },
  plugins: [],
};
