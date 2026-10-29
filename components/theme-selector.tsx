"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="theme-selector"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const selected = (theme ?? "system") === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} theme`}
            title={label}
            data-selected={selected || undefined}
            onClick={() => setTheme(value)}
            className="theme-option"
          >
            <Icon aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
