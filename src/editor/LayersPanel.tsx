import React, { useMemo, useState } from "react";
import type { Scene, SceneNode, Selection } from "../types";

type Props = {
  scene: Scene;
  onSelect: (sel: Selection) => void;
  onReorder: (activeId: string, overId: string) => void;
  onToggleVisibility: (nodeId: string) => void;
};

function LockIcon() {
  return (
    <svg className="layerActionSvg" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 7V5.6C5 3.61 6.34 2.25 8 2.25s3 1.36 3 3.35V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="3.75"
        y="7"
        width="8.5"
        height="6.4"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg className="layerActionSvg" viewBox="0 0 16 16" aria-hidden="true">
      {!hidden ? (
        <>
          <path
            d="M1.7 8s2.18-4 6.3-4 6.3 4 6.3 4-2.18 4-6.3 4-6.3-4-6.3-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="1.8" fill="currentColor" />
        </>
      ) : (
        <>
          <path
            d="M2 8s2.1-4 6-4 6 4 6 4-2.1 4-6 4-6-4-6-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            opacity="0.7"
          />
          <path
            d="M3 13 13 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function NodeIcon({ type }: { type: SceneNode["type"] }) {
  if (type === "frame") {
    return (
      <span className="layerNodeIcon layerFrameIcon" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  }

  if (type === "text") {
    return <span className="layerNodeIcon layerTextIcon">T</span>;
  }

  if (type === "ellipse") {
    return <span className="layerNodeIcon layerEllipseIcon" />;
  }

  if (type === "image") {
    return <span className="layerNodeIcon layerImageIcon" />;
  }

  return <span className="layerNodeIcon layerRectIcon" />;
}

function LayerRow({
  node,
  depth,
  isSelected,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  onToggleVisibility,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  node: SceneNode;
  depth: number;
  isSelected: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onToggleVisibility: () => void;
  onSelect: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const isHidden = !!node.hidden;

  return (
    <div
      draggable
      className={
        "figmaLayerRow " +
        (isSelected ? "selected " : "") +
        (isHidden ? "hiddenLayer " : "")
      }
      style={{ paddingLeft: 10 + depth * 18 }}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={
          "layerChevronBtn " +
          (!hasChildren ? "empty " : "") +
          (isCollapsed ? "collapsed" : "")
        }
        onClick={(e) => {
          e.stopPropagation();

          if (hasChildren) {
            onToggleCollapse();
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {hasChildren ? <span className="layerChevron">⌄</span> : null}
      </button>

      <NodeIcon type={node.type} />

      <div className="figmaLayerName" title={node.name}>
        {node.name}
      </div>

      <div className="figmaLayerActions">
        <button
          type="button"
          className="layerMiniAction"
          title="Lock"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <LockIcon />
        </button>

        <button
          type="button"
          className={"layerMiniAction " + (isHidden ? "isHidden" : "")}
          title={isHidden ? "Показати" : "Сховати"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <EyeIcon hidden={isHidden} />
        </button>
      </div>
    </div>
  );
}

export default function LayersPanel({
  scene,
  onSelect,
  onReorder,
  onToggleVisibility,
}: Props) {
  const artboards = scene?.artboards ?? [];
  const nodes = scene?.nodes ?? [];
  const selection = scene?.selection ?? { kind: "none" as const };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedArtboardIds, setCollapsedArtboardIds] = useState<Set<string>>(
    () => new Set()
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, SceneNode[]>();

    for (const node of nodes) {
      const key = node.parentId ?? null;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(node);
    }

    return map;
  }, [nodes]);

  function toggleNodeCollapse(nodeId: string) {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }

  function toggleArtboardCollapse(artboardId: string) {
    setCollapsedArtboardIds((prev) => {
      const next = new Set(prev);

      if (next.has(artboardId)) {
        next.delete(artboardId);
      } else {
        next.add(artboardId);
      }

      return next;
    });
  }

  function renderNodeTree(node: SceneNode, depth: number): React.ReactNode {
    const isSelected =
      selection.kind === "node" && selection.id === node.id;

    const children = childrenByParent.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedNodeIds.has(node.id);

    return (
      <React.Fragment key={node.id}>
        <LayerRow
          node={node}
          depth={depth}
          isSelected={isSelected}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => toggleNodeCollapse(node.id)}
          onToggleVisibility={() => onToggleVisibility(node.id)}
          onSelect={() => onSelect({ kind: "node", id: node.id })}
          onDragStart={() => setDraggingId(node.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();

            if (!draggingId || draggingId === node.id) return;

            onReorder(draggingId, node.id);
            setDraggingId(null);
          }}
        />

        {hasChildren && !isCollapsed
          ? children.map((child) => renderNodeTree(child, depth + 1))
          : null}
      </React.Fragment>
    );
  }

  return (
    <div
      className="figmaLayersTree"
      onDragEnd={() => setDraggingId(null)}
    >
      {artboards.length === 0 ? (
        <div className="muted">
          Немає артбордів. Натисни <b>A</b> або кнопку “+ Desktop”.
        </div>
      ) : (
        artboards.map((ab) => {
          const isAbSelected =
            selection.kind === "artboard" && selection.id === ab.id;

          const rootNodes = nodes.filter(
            (n) => n.artboardId === ab.id && !n.parentId
          );

          const isArtboardCollapsed = collapsedArtboardIds.has(ab.id);
          const hasArtboardChildren = rootNodes.length > 0;

          return (
            <div key={ab.id} className="figmaArtboardLayerGroup">
              <div
                className={
                  "figmaArtboardLayerRow " +
                  (isAbSelected ? "selected" : "")
                }
                onClick={() => onSelect({ kind: "artboard", id: ab.id })}
              >
                <button
                  type="button"
                  className={
                    "layerChevronBtn artboardChevronBtn " +
                    (!hasArtboardChildren ? "empty " : "") +
                    (isArtboardCollapsed ? "collapsed" : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();

                    if (hasArtboardChildren) {
                      toggleArtboardCollapse(ab.id);
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {hasArtboardChildren ? (
                    <span className="layerChevron">⌄</span>
                  ) : null}
                </button>

                <span className="figmaArtboardDot" />

                <span className="figmaArtboardName">{ab.name}</span>
              </div>

              {!isArtboardCollapsed
                ? rootNodes.map((node) => renderNodeTree(node, 0))
                : null}
            </div>
          );
        })
      )}
    </div>
  );
}