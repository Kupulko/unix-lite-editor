import React, { useMemo, useState } from "react";
import type { Scene, SceneNode, Selection } from "../types";

type Props = {
  scene: Scene;
  onSelect: (sel: Selection) => void;
  onReorder: (activeId: string, overId: string) => void;
};

function LayerRow({
  node,
  depth,
  isSelected,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  node: SceneNode;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      draggable
      className={"layerItem " + (isSelected ? "active" : "")}
      style={{ marginLeft: 14 + depth * 14, cursor: "grab" }}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="layerMeta">
        <div className="layerName">{node.name}</div>
        <div className="layerType">{node.type}</div>
      </div>
      <div className="small">
        {Math.round(node.x)},{Math.round(node.y)}
      </div>
    </div>
  );
}

export default function LayersPanel({ scene, onSelect, onReorder }: Props) {
  const artboards = scene?.artboards ?? [];
  const nodes = scene?.nodes ?? [];
  const selection = scene?.selection ?? { kind: "none" as const };

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, SceneNode[]>();
    for (const node of nodes) {
      const key = node.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    }
    return map;
  }, [nodes]);

  function renderNodeTree(node: SceneNode, depth: number): React.ReactNode {
    const isSelected = selection.kind === "node" && (selection as any).id === node.id;
    const children = childrenByParent.get(node.id) ?? [];

    return (
      <React.Fragment key={node.id}>
        <LayerRow
          node={node}
          depth={depth}
          isSelected={isSelected}
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
        {children.map((child) => renderNodeTree(child, depth + 1))}
      </React.Fragment>
    );
  }

  return (
    <div onDragEnd={() => setDraggingId(null)}>
      {artboards.length === 0 ? (
        <div className="muted">
          Немає артбордів. Натисни <b>A</b> або кнопку “+ Desktop”.
        </div>
      ) : (
        artboards.map((ab) => {
          const isAbSelected = selection.kind === "artboard" && (selection as any).id === ab.id;
          const rootNodes = nodes.filter((n) => n.artboardId === ab.id && !n.parentId);

          return (
            <div key={ab.id} style={{ marginBottom: 10 }}>
              <div
                className={"layerItem " + (isAbSelected ? "active" : "")}
                onClick={() => onSelect({ kind: "artboard", id: ab.id })}
              >
                <div className="layerMeta">
                  <div className="layerName">{ab.name}</div>
                  <div className="layerType">artboard</div>
                </div>
                <div className="small">
                  {Math.round(ab.x)},{Math.round(ab.y)}
                </div>
              </div>

              {rootNodes.map((n) => renderNodeTree(n, 0))}
            </div>
          );
        })
      )}
    </div>
  );
}