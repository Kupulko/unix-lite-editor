import React, { useMemo, useState } from "react";

type AddElementsPanelProps = {
  canAddNavigationButton: boolean;
  onAddDesktop: () => void;
  onAddFrame: () => void;
  onAddText: () => void;
  onAddImage: () => void;
  onAddHeader: () => void;
  onAddNavigationButton: () => void;
  onAddButton: () => void;
  onAddHero: () => void;
  onAddCard: () => void;
  onAddInput: () => void;
  onAddFooter: () => void;
  onAddSidebar: () => void;
};

type ElementItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  keywords: string[];
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
};

export default function AddElementsPanel({
  canAddNavigationButton,
  onAddDesktop,
  onAddFrame,
  onAddText,
  onAddImage,
  onAddHeader,
  onAddNavigationButton,
  onAddButton,
  onAddHero,
  onAddCard,
  onAddInput,
  onAddFooter,
  onAddSidebar,
}: AddElementsPanelProps) {
  const [query, setQuery] = useState("");

  const items = useMemo<ElementItem[]>(
    () => [
      {
        id: "desktop",
        title: "Desktop",
        description: "Створити новий артборд для сторінки.",
        category: "Canvas",
        icon: "▣",
        keywords: ["desktop", "artboard", "page", "canvas", "екран", "сторінка"],
        onClick: onAddDesktop,
      },
      {
        id: "frame",
        title: "Frame",
        description: "Контейнер для блоків і Auto Layout.",
        category: "Canvas",
        icon: "▤",
        keywords: ["frame", "container", "layout", "контейнер", "фрейм"],
        onClick: onAddFrame,
      },
      {
        id: "text",
        title: "Text",
        description: "Текстовий елемент, заголовок або підпис.",
        category: "Basic",
        icon: "T",
        keywords: ["text", "heading", "label", "title", "текст", "заголовок"],
        onClick: onAddText,
      },
      {
        id: "image",
        title: "Image",
        description: "Зображення або медіа-плейсхолдер.",
        category: "Basic",
        icon: "▧",
        keywords: ["image", "media", "picture", "photo", "зображення", "фото"],
        onClick: onAddImage,
      },
      {
        id: "header",
        title: "Header / Navigation",
        description: "Готова шапка сайту з логотипом, навігацією та CTA.",
        category: "Code-ready blocks",
        icon: "⌘",
        keywords: [
          "header",
          "navbar",
          "navigation",
          "nav",
          "menu",
          "хедер",
          "навігація",
          "меню",
        ],
        onClick: onAddHeader,
      },
      {
        id: "hero",
        title: "Hero Section",
        description: "Головний блок сторінки з заголовком, описом і кнопкою.",
        category: "Code-ready blocks",
        icon: "◫",
        keywords: ["hero", "section", "landing", "cover", "банер", "головний блок"],
        onClick: onAddHero,
      },
      {
        id: "card",
        title: "Card",
        description: "Картка для фічі, товару, статті або контентного блоку.",
        category: "Code-ready blocks",
        icon: "▱",
        keywords: ["card", "article", "feature", "product", "картка", "блок"],
        onClick: onAddCard,
      },
      {
        id: "footer",
        title: "Footer",
        description: "Нижній службовий блок сторінки.",
        category: "Code-ready blocks",
        icon: "▔",
        keywords: ["footer", "bottom", "copyright", "футер", "підвал"],
        onClick: onAddFooter,
      },
      {
        id: "sidebar",
        title: "Sidebar",
        description: "Бічна навігація для dashboard або кабінету.",
        category: "Code-ready blocks",
        icon: "▥",
        keywords: ["sidebar", "aside", "dashboard", "side navigation", "бічна панель"],
        onClick: onAddSidebar,
      },
      {
        id: "button",
        title: "Button",
        description: "Готова кнопка як контейнер + редагований текст.",
        category: "Controls",
        icon: "◉",
        keywords: ["button", "cta", "action", "кнопка"],
        onClick: onAddButton,
      },
      {
        id: "nav-button",
        title: "Navigation button",
        description: "Додати новий пункт у виділену навігацію або header.",
        category: "Controls",
        icon: "+",
        keywords: ["nav", "navigation", "header button", "menu item", "пункт меню", "кнопка навігації"],
        disabled: !canAddNavigationButton,
        disabledHint: "Спершу виділи Header, Navigation або кнопку всередині навігації.",
        onClick: onAddNavigationButton,
      },
      {
        id: "input",
        title: "Input Field",
        description: "Поле форми з label та редагованим placeholder.",
        category: "Controls",
        icon: "⌕",
        keywords: ["input", "field", "form", "email", "форма", "поле вводу"],
        onClick: onAddInput,
      },
    ],
    [
      canAddNavigationButton,
      onAddButton,
      onAddCard,
      onAddDesktop,
      onAddFooter,
      onAddFrame,
      onAddHeader,
      onAddHero,
      onAddImage,
      onAddInput,
      onAddNavigationButton,
      onAddSidebar,
      onAddText,
    ]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = items.filter((item) => {
    if (!normalizedQuery) return true;
    const haystack = [item.title, item.description, item.category, ...item.keywords]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const categories = Array.from(new Set(filteredItems.map((item) => item.category)));

  return (
    <div className="addElementsPanel">
      <div className="leftDrawerTitle">Add elements</div>

      <label className="addElementsSearchWrap">
        <span className="addElementsSearchIcon">⌕</span>
        <input
          className="addElementsSearchInput"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search elements..."
          autoComplete="off"
        />
      </label>

      <div className="addElementsHint">
        Блоки з позначкою code-ready мають семантичні ролі для майбутнього експорту в React-код.
      </div>

      <div className="addElementsScroll">
        {categories.length === 0 ? (
          <div className="addElementsEmpty">Нічого не знайдено.</div>
        ) : (
          categories.map((category) => (
            <section className="addElementsGroup" key={category}>
              <div className="addElementsGroupTitle">{category}</div>

              <div className="addElementsGrid">
                {filteredItems
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`addElementCard ${item.disabled ? "disabled" : ""}`}
                      onClick={item.disabled ? undefined : item.onClick}
                      disabled={item.disabled}
                      title={item.disabled ? item.disabledHint : item.description}
                    >
                      <span className="addElementCardIcon">{item.icon}</span>
                      <span className="addElementCardBody">
                        <span className="addElementCardTitle">{item.title}</span>
                        <span className="addElementCardDescription">
                          {item.disabled ? item.disabledHint : item.description}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
