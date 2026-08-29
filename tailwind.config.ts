import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
      fontFamily: {
        heading: [
          "ui-rounded",
          "'SF Pro Rounded'",
          "'Segoe UI'",
          "system-ui",
          "sans-serif",
        ],
        sans: ["system-ui", "'Segoe UI'", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
