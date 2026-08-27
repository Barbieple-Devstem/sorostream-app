"use client";

import { useTheme } from "@/src/lib/theme";

export default function ThemeToggle() {
  const { theme, isSystem, toggle, useSystemTheme } = useTheme();
  const isDark = theme === "dark" || theme === "high-contrast";
  const label = isDark ? "☀️ Light" : "🌙 Dark";
  const ariaLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        aria-label={ariaLabel}
        title={
          isSystem
            ? "Following system preference"
            : theme === "high-contrast"
            ? "High contrast mode"
            : "Theme set manually"
        }
      >
        {label}
      </button>
      {!isSystem && (
        <button
          onClick={useSystemTheme}
          className="text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-md px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          aria-label="Follow system theme preference"
          title="Use system preference"
        >
          Auto
        </button>
      )}
    </div>
  );
}
