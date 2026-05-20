import React, { useEffect, useMemo, useRef, useState } from "react";

type FontCategory = "all" | "sans" | "serif" | "display" | "mono";

type FontOption = {
  label: string;
  family: string;
  category: Exclude<FontCategory, "all">;
};

const FONT_OPTIONS: FontOption[] = [
  { label: "Inter", family: "Inter, Arial, sans-serif", category: "sans" },
  { label: "Manrope", family: "Manrope, Arial, sans-serif", category: "sans" },
  { label: "Roboto", family: "Roboto, Arial, sans-serif", category: "sans" },
  { label: "Open Sans", family: '"Open Sans", Arial, sans-serif', category: "sans" },
  { label: "Montserrat", family: "Montserrat, Arial, sans-serif", category: "sans" },
  { label: "Poppins", family: "Poppins, Arial, sans-serif", category: "sans" },
  { label: "Nunito", family: "Nunito, Arial, sans-serif", category: "sans" },
  { label: "Rubik", family: "Rubik, Arial, sans-serif", category: "sans" },
  { label: "Raleway", family: "Raleway, Arial, sans-serif", category: "sans" },
  { label: "IBM Plex Sans", family: '"IBM Plex Sans", Arial, sans-serif', category: "sans" },
  { label: "Fira Sans", family: '"Fira Sans", Arial, sans-serif', category: "sans" },

  { label: "Georgia", family: "Georgia, serif", category: "serif" },
  { label: "Lora", family: "Lora, Georgia, serif", category: "serif" },
  { label: "Merriweather", family: "Merriweather, Georgia, serif", category: "serif" },
  { label: "Playfair Display", family: '"Playfair Display", Georgia, serif', category: "serif" },
  { label: "PT Serif", family: '"PT Serif", Georgia, serif', category: "serif" },
  { label: "Cormorant Garamond", family: '"Cormorant Garamond", Georgia, serif', category: "serif" },

  { label: "Bebas Neue", family: '"Bebas Neue", Arial, sans-serif', category: "display" },
  { label: "Oswald", family: "Oswald, Arial, sans-serif", category: "display" },
  { label: "Pacifico", family: "Pacifico, cursive", category: "display" },
  { label: "Cinzel", family: "Cinzel, Georgia, serif", category: "display" },
  { label: "Orbitron", family: "Orbitron, Arial, sans-serif", category: "display" },

  { label: "JetBrains Mono", family: '"JetBrains Mono", Consolas, monospace', category: "mono" },
  { label: "Fira Code", family: '"Fira Code", Consolas, monospace', category: "mono" },
  { label: "IBM Plex Mono", family: '"IBM Plex Mono", Consolas, monospace', category: "mono" },
  { label: "Courier New", family: '"Courier New", monospace', category: "mono" },
];

const CATEGORY_LABELS: Record<FontCategory, string> = {
  all: "All fonts",
  sans: "Sans serif",
  serif: "Serif",
  display: "Display",
  mono: "Monospace",
};

const GOOGLE_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700;800&family=Orbitron:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&family=Pacifico&family=Playfair+Display:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=PT+Serif:wght@400;700&family=Raleway:wght@400;500;600;700;800&family=Roboto:wght@400;500;700;900&family=Rubik:wght@400;500;600;700;800&display=swap";

export function getFontLabel(fontFamily: string) {
  const found = FONT_OPTIONS.find((font) => font.family === fontFamily);
  if (found) return found.label;

  const firstPart = fontFamily.split(",")[0]?.replace(/\"/g, "").trim();
  return firstPart || "Inter";
}

type FontPickerPopoverProps = {
  value: string;
  anchorRect: DOMRect | null;
  onChange: (fontFamily: string) => void;
  onClose: () => void;
};

export default function FontPickerPopover({
  value,
  anchorRect,
  onChange,
  onClose,
}: FontPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontCategory>("all");

  useEffect(() => {
    const id = "orix-font-library";
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONT_HREF;
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const filteredFonts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return FONT_OPTIONS.filter((font) => {
      const matchesCategory = category === "all" || font.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        font.label.toLowerCase().includes(normalizedQuery) ||
        font.family.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const left = anchorRect ? Math.max(16, anchorRect.left - 344) : 120;
  const top = anchorRect ? Math.max(16, anchorRect.top - 120) : 120;

  return (
    <div
      ref={popoverRef}
      className="fontPickerPopover"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="fontPickerHeader">
        <div className="fontPickerTitle">Fonts</div>

        <button
          type="button"
          className="fontPickerClose"
          onClick={onClose}
          aria-label="Close fonts"
        >
          ×
        </button>
      </div>

      <label className="fontPickerSearch">
        <span className="fontPickerSearchIcon">⌕</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search fonts"
        />
        {query && (
          <button
            type="button"
            className="fontPickerClear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </label>

      <select
        className="fontPickerCategory"
        value={category}
        onChange={(event) => setCategory(event.target.value as FontCategory)}
      >
        {(Object.keys(CATEGORY_LABELS) as FontCategory[]).map((key) => (
          <option key={key} value={key}>
            {CATEGORY_LABELS[key]}
          </option>
        ))}
      </select>

      <div className="fontPickerList">
        {filteredFonts.map((font) => {
          const active = font.family === value;

          return (
            <button
              key={font.family}
              type="button"
              className={`fontPickerOption ${active ? "active" : ""}`}
              onClick={() => onChange(font.family)}
            >
              <span className="fontPickerOptionName" style={{ fontFamily: font.family }}>
                {font.label}
              </span>
              <span className="fontPickerOptionMeta">{CATEGORY_LABELS[font.category]}</span>
            </button>
          );
        })}

        {filteredFonts.length === 0 && (
          <div className="fontPickerEmpty">Nothing matches this search.</div>
        )}
      </div>
    </div>
  );
}
