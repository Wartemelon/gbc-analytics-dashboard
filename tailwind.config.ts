import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#102A43",
        mist: "#F6F8FB",
        sand: "#FFF8EF",
        coral: "#FF845F",
        mint: "#8FD3C7",
        slate: "#486581"
      },
      fontFamily: {
        sans: ["Avenir Next", "Montserrat", "Segoe UI", "sans-serif"],
        serif: ["Iowan Old Style", "Palatino Linotype", "Book Antiqua", "serif"]
      },
      boxShadow: {
        panel: "0 18px 50px rgba(16, 42, 67, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
