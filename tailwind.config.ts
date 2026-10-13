import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        sm: "0.75rem",
        DEFAULT: "1rem",
        md: "1rem",
        lg: "1.25rem",
        xl: "1.5rem",
        "2xl": "2rem",
        "3xl": "2.5rem",
      },
      colors: {
        forest: "#123524",
        forestdeep: "#0B2418",
        gold: "#C9A227",
        accent: "rgb(var(--accent-text) / <alpha-value>)",
        goldlight: "#E4C766",
        paper: "#F6F3EC",
        graphite: "#1F2421",
        blueprint: "#2C4A48",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        blueprintgrid:
          "linear-gradient(rgba(201,162,39,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "36px 36px",
      },
    },
  },
  plugins: [],
};
export default config;
