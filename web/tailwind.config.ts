import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    borderRadius: {
      none: "0px",
      DEFAULT: "0px",
      sm: "0px",
      md: "0px",
      lg: "0px",
      xl: "0px",
      "2xl": "0px",
      "3xl": "0px",
      full: "0px",
    },
    extend: {
      colors: {
        "bg-darkest": "#0f0e17",
        "bg-dark": "#1a1a2e",
        "bg-mid": "#232946",
        "bg-panel": "#2d334a",
        "bg-panel-light": "#3a3f5c",
        "border-dark": "#111122",
        "border-light": "#4a4e6e",
        "border-highlight": "#6e72a0",
        "text-default": "#d4d4e0",
        "text-dim": "#8888aa",
        "text-bright": "#fffffe",
        gold: "#f5c542",
        "gold-dark": "#c49a2a",
        green: "#2ee67a",
        "green-dark": "#1a9e50",
        blue: "#4488ff",
        red: "#ff4455",
        "red-dark": "#bb2233",
        purple: "#cc44ff",
        orange: "#ff8844",
        cyan: "#44ddee",
        brown: "#8d6e52",
        stone: "#6e7788",
        "hp-red": "#e24040",
        "mp-blue": "#4080e2",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
      boxShadow: {
        "pixel": "inset -2px -2px 0 #111122, inset 2px 2px 0 #4a4e6e",
        "pixel-raised": "inset -2px -2px 0 #111122, inset 2px 2px 0 #6e72a0, 4px 4px 0 #0a0a14",
        "pixel-gold": "inset -2px -2px 0 #c49a2a, inset 2px 2px 0 #ffe066, 4px 4px 0 #0a0a14",
        "pixel-pressed": "inset 2px 2px 0 #111122, inset -2px -2px 0 #4a4e6e",
      },
      keyframes: {
        "pixel-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "step-fade-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "50%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "xp-fill": {
          "0%": { width: "0%" },
          "100%": { width: "72%" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "pixel-blink": "pixel-blink 1s steps(1) infinite",
        "step-fade-in": "step-fade-in 0.6s steps(4) forwards",
        "xp-fill": "xp-fill 2s steps(20) forwards",
        "float": "float 3s steps(6) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
