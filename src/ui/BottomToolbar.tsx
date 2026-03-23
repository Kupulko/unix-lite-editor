import React, { useEffect, useRef, useState } from "react";

export type Tool =
  | "select"
  | "hand"
  | "rect"
  | "line"
  | "arrow"
  | "ellipse"
  | "polygon"
  | "star"
  | "image"
  | "text";

type Props = {
  tool: Tool;
  onTool: (t: Tool) => void;
};

type ShapeMenuItem = {
  key: Exclude<Tool, "select" | "hand" | "text">;
  label: string;
  shortcut?: string;
  icon: string;
};

const SHAPE_ITEMS: ShapeMenuItem[] = [
  { key: "rect", label: "Rectangle", shortcut: "R", icon: "□" },
  { key: "line", label: "Line", shortcut: "L", icon: "／" },
  { key: "arrow", label: "Arrow", shortcut: "Shift+L", icon: "↗" },
  { key: "ellipse", label: "Ellipse", shortcut: "O", icon: "○" },
  { key: "polygon", label: "Polygon", icon: "△" },
  { key: "star", label: "Star", icon: "☆" },
  { key: "image", label: "Image/video...", shortcut: "Ctrl+Shift+K", icon: "▣" },
];

function isShapeTool(tool: Tool) {
  return ["rect", "line", "arrow", "ellipse", "polygon", "star", "image"].includes(tool);
}

export default function BottomToolbar({ tool, onTool }: Props) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const shapesWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!shapesWrapRef.current) return;
      if (!shapesWrapRef.current.contains(e.target as Node)) {
        setShapesOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShapesOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const activeShapeTool: ShapeMenuItem["key"] =
    isShapeTool(tool) ? (tool as ShapeMenuItem["key"]) : "rect";

  return (
    <div className="bottombar">
      <div className="toolbar">
        <div
          className={"toolBtn " + (tool === "select" ? "active" : "")}
          onClick={() => {
            setShapesOpen(false);
            onTool("select");
          }}
          title="Select (V)"
        >
          <img src="/images/cursor-512.png" alt="Select" style={{ width: 25, height: "auto" }} />
        </div>

        <div
          className={"toolBtn " + (tool === "hand" ? "active" : "")}
          onClick={() => {
            setShapesOpen(false);
            onTool("hand");
          }}
          title="Hand (Space)"
        >
          <img src="/images/moving.png" alt="Hand" style={{ width: 25, height: "auto" }} />
        </div>

        <div className="shapeToolWrap" ref={shapesWrapRef}>
          <div
            className={"toolBtn " + (isShapeTool(tool) ? "active" : "")}
            onClick={() => setShapesOpen((v) => !v)}
            title="Shapes"
          >
            <img src="/images/shapes.png" alt="Shapes" style={{ width: 23, height: "auto" }} />
          </div>

          {shapesOpen && (
            <div className="shapeMenu">
              {SHAPE_ITEMS.map((item) => {
                const active = activeShapeTool === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={"shapeMenuItem " + (active ? "active" : "")}
                    onClick={() => {
                      onTool(item.key);
                      setShapesOpen(false);
                    }}
                  >
                    <span className="shapeMenuLeft">
                      <span className="shapeMenuCheck">{active ? "✓" : ""}</span>
                      <span className="shapeMenuIcon">{item.icon}</span>
                      <span className="shapeMenuLabel">{item.label}</span>
                    </span>

                    <span className="shapeMenuShortcut">{item.shortcut ?? ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={"toolBtn " + (tool === "text" ? "active" : "")}
          onClick={() => {
            setShapesOpen(false);
            onTool("text");
          }}
          title="Text (T)"
        >
          <img src="/images/textbutt.png" alt="Text" style={{ width: 25, height: "auto" }} />
        </div>
      </div>
    </div>
  );
}