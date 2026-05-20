import React from "react";

export type LeftPanelView = "add" | "logic" | "files";

type LeftSidebarProps = {
  activeView: LeftPanelView | null;
  onActiveViewChange: (view: LeftPanelView | null) => void;
  addContent: React.ReactNode;
  logicContent: React.ReactNode;
  filesContent: React.ReactNode;
};

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2.5" fill="currentColor" />
      <path
        d="M12 8V16M8 12H16"
        stroke="#2b2b2b"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 20 7.8V16.2L12 20.5 4 16.2V7.8L12 3.5Z"
        fill="currentColor"
      />
      <path
        d="M12 12.1 20 7.8M12 12.1 4 7.8M12 12.1V20.5"
        stroke="#2b2b2b"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 7.2C3.5 6 4.5 5 5.7 5H10L12 7H18.3C19.6 7 20.5 8 20.5 9.2V17.2C20.5 18.5 19.5 19.5 18.3 19.5H5.7C4.4 19.5 3.5 18.5 3.5 17.2V7.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

type RailButtonProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function RailButton({
  active,
  label,
  onClick,
  children,
}: RailButtonProps) {
  return (
    <button
      type="button"
      className={`leftRailButton ${active ? "active" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span className="leftRailIcon">{children}</span>
      <span className="leftRailTooltip">{label}</span>
    </button>
  );
}

function getFloatingContent(
  activeView: LeftPanelView,
  addContent: React.ReactNode,
  logicContent: React.ReactNode,
  filesContent: React.ReactNode
) {
  if (activeView === "add") return addContent;
  if (activeView === "logic") return logicContent;
  return filesContent;
}

export default function LeftSidebar({
  activeView,
  onActiveViewChange,
  addContent,
  logicContent,
  filesContent,
}: LeftSidebarProps) {
  function toggleView(view: LeftPanelView) {
    onActiveViewChange(activeView === view ? null : view);
  }

  return (
    <>
      <aside className="sidePanel leftPanel">
        <div className="leftSidebarShell">
          <nav className="leftIconRail" aria-label="Left tools">
            <RailButton
              active={activeView === "add"}
              label="Add elements"
              onClick={() => toggleView("add")}
            >
              <AddIcon />
            </RailButton>

            <RailButton
              active={activeView === "logic"}
              label="Logic"
              onClick={() => toggleView("logic")}
            >
              <LogicIcon />
            </RailButton>

            <RailButton
              active={activeView === "files"}
              label="File System"
              onClick={() => toggleView("files")}
            >
              <FolderIcon />
            </RailButton>
          </nav>
        </div>
      </aside>

      {activeView && (
        <section className="leftFloatingPanel" aria-label={`${activeView} panel`}>
          <button
            type="button"
            className="leftFloatingPanelClose"
            onClick={() => onActiveViewChange(null)}
            aria-label="Close panel"
            title="Close"
          >
            ×
          </button>

          <div className="leftFloatingPanelContent">
            {getFloatingContent(activeView, addContent, logicContent, filesContent)}
          </div>
        </section>
      )}
    </>
  );
}
