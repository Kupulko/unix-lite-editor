import type {
  AutoLayout,
  AutoLayoutAlign,
  FrameNode,
  Scene,
  SceneNode,
} from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function safeNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isFrameNode(node: SceneNode | null | undefined): node is FrameNode {
  return !!node && node.type === "frame";
}

export function findNode(scene: Scene, id: string) {
  return scene.nodes.find((n) => n.id === id) ?? null;
}

export function getNodeChildren(scene: Scene, parentId: string) {
  return scene.nodes.filter((n) => n.parentId === parentId);
}

export function getTopLevelNodes(scene: Scene, artboardId: string) {
  return scene.nodes.filter((n) => n.artboardId === artboardId && !n.parentId);
}

export function getSiblingNodes(scene: Scene, node: SceneNode) {
  return scene.nodes.filter(
    (n) => n.artboardId === node.artboardId && (n.parentId ?? null) === (node.parentId ?? null)
  );
}

export function getSiblingIndexes(scene: Scene, node: SceneNode) {
  const siblings = getSiblingNodes(scene, node);
  const ids = new Set(siblings.map((n) => n.id));
  return scene.nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => ids.has(n.id))
    .map(({ i }) => i);
}

function moveIndex<T>(arr: T[], from: number, to: number) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function bringNodeToFront(scene: Scene, nodeId: string): Scene {
  const node = findNode(scene, nodeId);
  if (!node) return scene;

  const siblingIndexes = getSiblingIndexes(scene, node);
  if (siblingIndexes.length <= 1) return scene;

  const from = scene.nodes.findIndex((n) => n.id === nodeId);
  const to = siblingIndexes[siblingIndexes.length - 1];
  if (from === -1 || from === to) return scene;

  return { ...scene, nodes: moveIndex(scene.nodes, from, to) };
}

export function sendNodeToBack(scene: Scene, nodeId: string): Scene {
  const node = findNode(scene, nodeId);
  if (!node) return scene;

  const siblingIndexes = getSiblingIndexes(scene, node);
  if (siblingIndexes.length <= 1) return scene;

  const from = scene.nodes.findIndex((n) => n.id === nodeId);
  const to = siblingIndexes[0];
  if (from === -1 || from === to) return scene;

  return { ...scene, nodes: moveIndex(scene.nodes, from, to) };
}

export function bringNodeForward(scene: Scene, nodeId: string): Scene {
  const node = findNode(scene, nodeId);
  if (!node) return scene;

  const siblingIndexes = getSiblingIndexes(scene, node);
  const from = scene.nodes.findIndex((n) => n.id === nodeId);
  const pos = siblingIndexes.indexOf(from);
  if (from === -1 || pos === -1 || pos === siblingIndexes.length - 1) return scene;

  return { ...scene, nodes: moveIndex(scene.nodes, from, siblingIndexes[pos + 1]) };
}

export function sendNodeBackward(scene: Scene, nodeId: string): Scene {
  const node = findNode(scene, nodeId);
  if (!node) return scene;

  const siblingIndexes = getSiblingIndexes(scene, node);
  const from = scene.nodes.findIndex((n) => n.id === nodeId);
  const pos = siblingIndexes.indexOf(from);
  if (from === -1 || pos <= 0) return scene;

  return { ...scene, nodes: moveIndex(scene.nodes, from, siblingIndexes[pos - 1]) };
}

export function reorderNodeRelative(scene: Scene, activeId: string, overId: string): Scene {
  if (activeId === overId) return scene;

  const active = findNode(scene, activeId);
  const over = findNode(scene, overId);
  if (!active || !over) return scene;

  if (
    active.artboardId !== over.artboardId ||
    (active.parentId ?? null) !== (over.parentId ?? null)
  ) {
    return scene;
  }

  const from = scene.nodes.findIndex((n) => n.id === activeId);
  const to = scene.nodes.findIndex((n) => n.id === overId);
  if (from === -1 || to === -1) return scene;

  return { ...scene, nodes: moveIndex(scene.nodes, from, to) };
}

export function assignNodeToFrame(scene: Scene, nodeId: string, frameId: string | null): Scene {
  const node = findNode(scene, nodeId);
  if (!node) return scene;

  if (frameId === node.id) return scene;

  if (frameId) {
    const frame = findNode(scene, frameId);
    if (!frame || frame.type !== "frame") return scene;
    if (frame.artboardId !== node.artboardId) return scene;
    if (isDescendant(scene, frameId, node.id)) return scene;

    return {
      ...scene,
      nodes: scene.nodes.map((n) =>
        n.id === nodeId ? ({ ...n, parentId: frameId, artboardId: frame.artboardId } as SceneNode) : n
      ),
    };
  }

  return {
    ...scene,
    nodes: scene.nodes.map((n) =>
      n.id === nodeId ? ({ ...n, parentId: null } as SceneNode) : n
    ),
  };
}

export function isDescendant(scene: Scene, maybeChildId: string, maybeAncestorId: string): boolean {
  let current = findNode(scene, maybeChildId);
  while (current?.parentId) {
    if (current.parentId === maybeAncestorId) return true;
    current = findNode(scene, current.parentId);
  }
  return false;
}

function getChildrenOrdered(scene: Scene, parentId: string) {
  return scene.nodes.filter((n) => n.parentId === parentId);
}

function alignCross(
  align: AutoLayoutAlign,
  containerSize: number,
  childSize: number,
  padding: number
) {
  if (align === "start") return padding;
  if (align === "center") return Math.max(padding, (containerSize - childSize) / 2);
  return Math.max(padding, containerSize - padding - childSize);
}

function normalizeAutoLayout(layout?: AutoLayout): AutoLayout | undefined {
  if (!layout) return undefined;

  return {
    enabled: layout.enabled ?? true,
    direction: layout.direction === "vertical" ? "vertical" : "horizontal",
    gap: safeNumber(layout.gap, 12),
    paddingX: safeNumber(layout.paddingX, 16),
    paddingY: safeNumber(layout.paddingY, 16),
    align:
      layout.align === "center" || layout.align === "end" ? layout.align : "start",
    hugContent: !!layout.hugContent,
  };
}

export function applyAutoLayoutToScene(scene: Scene): Scene {
  let nextNodes = scene.nodes.map((n) => ({ ...n })) as SceneNode[];

  const mapById = new Map(nextNodes.map((n) => [n.id, n]));

  const frames = nextNodes.filter((n) => n.type === "frame") as FrameNode[];

  for (const frame of frames) {
    frame.autoLayout = normalizeAutoLayout(frame.autoLayout);

    if (!frame.autoLayout?.enabled) continue;

    const children = getChildrenOrdered({ ...scene, nodes: nextNodes }, frame.id);
    if (children.length === 0) continue;

    let cursor = 0;

    if (frame.autoLayout.direction === "horizontal") {
      for (const child of children) {
        child.x = frame.x + frame.autoLayout.paddingX + cursor;
        child.y =
          frame.y +
          alignCross(frame.autoLayout.align, frame.height, child.height, frame.autoLayout.paddingY);

        cursor += child.width + frame.autoLayout.gap;
      }

      if (frame.autoLayout.hugContent) {
        const contentWidth =
          frame.autoLayout.paddingX * 2 +
          children.reduce((sum, child) => sum + child.width, 0) +
          frame.autoLayout.gap * Math.max(0, children.length - 1);

        const contentHeight =
          frame.autoLayout.paddingY * 2 +
          Math.max(...children.map((child) => child.height));

        frame.width = Math.max(40, contentWidth);
        frame.height = Math.max(40, contentHeight);

        for (const child of children) {
          child.y =
            frame.y +
            alignCross(frame.autoLayout.align, frame.height, child.height, frame.autoLayout.paddingY);
        }
      }
    } else {
      for (const child of children) {
        child.y = frame.y + frame.autoLayout.paddingY + cursor;
        child.x =
          frame.x +
          alignCross(frame.autoLayout.align, frame.width, child.width, frame.autoLayout.paddingX);

        cursor += child.height + frame.autoLayout.gap;
      }

      if (frame.autoLayout.hugContent) {
        const contentHeight =
          frame.autoLayout.paddingY * 2 +
          children.reduce((sum, child) => sum + child.height, 0) +
          frame.autoLayout.gap * Math.max(0, children.length - 1);

        const contentWidth =
          frame.autoLayout.paddingX * 2 +
          Math.max(...children.map((child) => child.width));

        frame.width = Math.max(40, contentWidth);
        frame.height = Math.max(40, contentHeight);

        for (const child of children) {
          child.x =
            frame.x +
            alignCross(frame.autoLayout.align, frame.width, child.width, frame.autoLayout.paddingX);
        }
      }
    }

    mapById.set(frame.id, frame);
    for (const child of children) {
      mapById.set(child.id, child);
    }
  }

  nextNodes = nextNodes.map((n) => mapById.get(n.id) ?? n);
  return { ...scene, nodes: nextNodes };
}

export type AutoLayoutDropDirection = "horizontal" | "vertical";
export type AutoLayoutDropSide = "before" | "after";

export type AutoLayoutDropCandidate =
  | {
      kind: "merge";
      draggedId: string;
      targetId: string;
      direction: AutoLayoutDropDirection;
      side: AutoLayoutDropSide;
      previewRect: { x: number; y: number; width: number; height: number };
      insertLine: { x1: number; y1: number; x2: number; y2: number };
    }
  | {
      kind: "insert";
      draggedId: string;
      frameId: string;
      direction: AutoLayoutDropDirection;
      insertIndex: number;
      previewRect: { x: number; y: number; width: number; height: number };
      insertLine: { x1: number; y1: number; x2: number; y2: number };
    };

const AUTO_LAYOUT_JOIN_DISTANCE = 48;
const AUTO_LAYOUT_FRAME_HOVER_PADDING = 28;

function nodeCenter(node: SceneNode) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function expandedRectContains(
  node: SceneNode,
  x: number,
  y: number,
  padding: number
) {
  return (
    x >= node.x - padding &&
    x <= node.x + node.width + padding &&
    y >= node.y - padding &&
    y <= node.y + node.height + padding
  );
}

function overlapAmount(a1: number, a2: number, b1: number, b2: number) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function gapAlongAxis(
  dragged: SceneNode,
  target: SceneNode,
  direction: AutoLayoutDropDirection
) {
  if (direction === "horizontal") {
    if (dragged.x + dragged.width <= target.x) {
      return target.x - (dragged.x + dragged.width);
    }

    if (target.x + target.width <= dragged.x) {
      return dragged.x - (target.x + target.width);
    }

    return 0;
  }

  if (dragged.y + dragged.height <= target.y) {
    return target.y - (dragged.y + dragged.height);
  }

  if (target.y + target.height <= dragged.y) {
    return dragged.y - (target.y + target.height);
  }

  return 0;
}

function makePreviewRect(a: SceneNode, b: SceneNode) {
  const padding = 16;

  const x = Math.min(a.x, b.x) - padding;
  const y = Math.min(a.y, b.y) - padding;
  const right = Math.max(a.x + a.width, b.x + b.width) + padding;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + padding;

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function makeMergeInsertLine(
  dragged: SceneNode,
  target: SceneNode,
  direction: AutoLayoutDropDirection,
  side: AutoLayoutDropSide
) {
  if (direction === "horizontal") {
    const x =
      side === "before"
        ? target.x - 8
        : target.x + target.width + 8;

    return {
      x1: x,
      y1: Math.min(dragged.y, target.y) - 8,
      x2: x,
      y2: Math.max(dragged.y + dragged.height, target.y + target.height) + 8,
    };
  }

  const y =
    side === "before"
      ? target.y - 8
      : target.y + target.height + 8;

  return {
    x1: Math.min(dragged.x, target.x) - 8,
    y1: y,
    x2: Math.max(dragged.x + dragged.width, target.x + target.width) + 8,
    y2: y,
  };
}

function orderedAutoLayoutChildren(scene: Scene, frame: FrameNode) {
  const direction =
    frame.autoLayout?.direction === "vertical" ? "vertical" : "horizontal";

  return scene.nodes
    .filter((node) => node.parentId === frame.id)
    .sort((a, b) =>
      direction === "horizontal" ? a.x - b.x : a.y - b.y
    );
}

function getInsertIndexForFrame(
  frame: FrameNode,
  children: SceneNode[],
  dragged: SceneNode
) {
  const direction =
    frame.autoLayout?.direction === "vertical" ? "vertical" : "horizontal";

  const center = nodeCenter(dragged);

  if (direction === "horizontal") {
    const index = children.findIndex(
      (child) => center.x < nodeCenter(child).x
    );

    return index === -1 ? children.length : index;
  }

  const index = children.findIndex(
    (child) => center.y < nodeCenter(child).y
  );

  return index === -1 ? children.length : index;
}

function makeFrameInsertLine(
  frame: FrameNode,
  children: SceneNode[],
  insertIndex: number
) {
  const direction =
    frame.autoLayout?.direction === "vertical" ? "vertical" : "horizontal";

  const gap = frame.autoLayout?.gap ?? 12;
  const paddingX = frame.autoLayout?.paddingX ?? 16;
  const paddingY = frame.autoLayout?.paddingY ?? 16;

  if (direction === "horizontal") {
    let x = frame.x + paddingX;

    if (children.length === 0) {
      x = frame.x + paddingX;
    } else if (insertIndex <= 0) {
      x = children[0].x - gap / 2;
    } else if (insertIndex >= children.length) {
      const last = children[children.length - 1];
      x = last.x + last.width + gap / 2;
    } else {
      const prev = children[insertIndex - 1];
      const next = children[insertIndex];
      x = (prev.x + prev.width + next.x) / 2;
    }

    return {
      x1: x,
      y1: frame.y + 6,
      x2: x,
      y2: frame.y + frame.height - 6,
    };
  }

  let y = frame.y + paddingY;

  if (children.length === 0) {
    y = frame.y + paddingY;
  } else if (insertIndex <= 0) {
    y = children[0].y - gap / 2;
  } else if (insertIndex >= children.length) {
    const last = children[children.length - 1];
    y = last.y + last.height + gap / 2;
  } else {
    const prev = children[insertIndex - 1];
    const next = children[insertIndex];
    y = (prev.y + prev.height + next.y) / 2;
  }

  return {
    x1: frame.x + 6,
    y1: y,
    x2: frame.x + frame.width - 6,
    y2: y,
  };
}

export function findAutoLayoutDropCandidate(
  scene: Scene,
  draggedId: string,
  worldX: number,
  worldY: number
): AutoLayoutDropCandidate | null {
  const draggedOriginal = findNode(scene, draggedId);
  if (!draggedOriginal) return null;

  const dragged: SceneNode = {
    ...draggedOriginal,
    x: worldX,
    y: worldY,
  };

  const draggedCenter = nodeCenter(dragged);

  const autoLayoutFrames = scene.nodes
    .filter(
      (node): node is FrameNode =>
        node.type === "frame" &&
        node.autoLayout?.enabled === true &&
        node.artboardId === dragged.artboardId &&
        node.id !== dragged.id &&
        !isDescendant(scene, node.id, dragged.id)
    )
    .sort((a, b) => a.width * a.height - b.width * b.height);

 for (const frame of autoLayoutFrames) {
  const children = orderedAutoLayoutChildren(scene, frame).filter(
    (child) => child.id !== dragged.id
  );

  // Якщо цільовий Auto Layout ще порожній,
  // а ми тягнемо до нього інший Frame на тому ж рівні,
  // тоді НЕ вкладаємо один в інший — нижче створиться спільний layout.
  //
  // Але якщо Auto Layout уже має дітей,
  // то дозволяємо вставити витягнутий блок назад усередину нього.
  const isEmptyAutoLayoutFrame = children.length === 0;

  if (
    dragged.type === "frame" &&
    isEmptyAutoLayoutFrame &&
    (frame.parentId ?? null) === (dragged.parentId ?? null)
  ) {
    continue;
  }

  if (
    !expandedRectContains(
      frame,
      draggedCenter.x,
      draggedCenter.y,
      AUTO_LAYOUT_FRAME_HOVER_PADDING
    )
  ) {
    continue;
  }

    const insertIndex = getInsertIndexForFrame(frame, children, dragged);
    const direction =
      frame.autoLayout?.direction === "vertical" ? "vertical" : "horizontal";

    return {
      kind: "insert",
      draggedId,
      frameId: frame.id,
      direction,
      insertIndex,
      previewRect: {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      },
      insertLine: makeFrameInsertLine(frame, children, insertIndex),
    };
  }

  let best:
    | {
        target: SceneNode;
        direction: AutoLayoutDropDirection;
        side: AutoLayoutDropSide;
        score: number;
      }
    | null = null;

  for (const target of scene.nodes) {
    if (target.id === dragged.id) continue;
    if (target.artboardId !== dragged.artboardId) continue;
    if ((target.parentId ?? null) !== (dragged.parentId ?? null)) continue;
    if (isDescendant(scene, target.id, dragged.id)) continue;

    const targetCenter = nodeCenter(target);

    const horizontalGap = gapAlongAxis(dragged, target, "horizontal");
    const verticalGap = gapAlongAxis(dragged, target, "vertical");

    const horizontalOverlap = overlapAmount(
      dragged.y,
      dragged.y + dragged.height,
      target.y,
      target.y + target.height
    );

    const verticalOverlap = overlapAmount(
      dragged.x,
      dragged.x + dragged.width,
      target.x,
      target.x + target.width
    );

    const canMergeHorizontally =
      horizontalGap <= AUTO_LAYOUT_JOIN_DISTANCE &&
      (horizontalOverlap > 0 ||
        Math.abs(draggedCenter.y - targetCenter.y) <=
          Math.max(dragged.height, target.height) * 0.65);

    const canMergeVertically =
      verticalGap <= AUTO_LAYOUT_JOIN_DISTANCE &&
      (verticalOverlap > 0 ||
        Math.abs(draggedCenter.x - targetCenter.x) <=
          Math.max(dragged.width, target.width) * 0.65);

    if (canMergeHorizontally) {
      const side: AutoLayoutDropSide =
        draggedCenter.x < targetCenter.x ? "before" : "after";

      const score =
        horizontalGap + Math.abs(draggedCenter.y - targetCenter.y) * 0.15;

      if (!best || score < best.score) {
        best = {
          target,
          direction: "horizontal",
          side,
          score,
        };
      }
    }

    if (canMergeVertically) {
      const side: AutoLayoutDropSide =
        draggedCenter.y < targetCenter.y ? "before" : "after";

      const score =
        verticalGap + Math.abs(draggedCenter.x - targetCenter.x) * 0.15;

      if (!best || score < best.score) {
        best = {
          target,
          direction: "vertical",
          side,
          score,
        };
      }
    }
  }

  if (!best) return null;

  return {
    kind: "merge",
    draggedId,
    targetId: best.target.id,
    direction: best.direction,
    side: best.side,
    previewRect: makePreviewRect(dragged, best.target),
    insertLine: makeMergeInsertLine(
      dragged,
      best.target,
      best.direction,
      best.side
    ),
  };
}

function measuredGap(
  first: SceneNode,
  second: SceneNode,
  direction: AutoLayoutDropDirection
) {
  if (direction === "horizontal") {
    const gap = second.x - (first.x + first.width);
    return gap > 0 ? clamp(Math.round(gap), 0, 120) : 12;
  }

  const gap = second.y - (first.y + first.height);
  return gap > 0 ? clamp(Math.round(gap), 0, 120) : 12;
}

export function createAutoLayoutFrameFromDrop(
  scene: Scene,
  draggedId: string,
  targetId: string,
  direction: AutoLayoutDropDirection,
  side: AutoLayoutDropSide
): Scene {
  const dragged = findNode(scene, draggedId);
  const target = findNode(scene, targetId);

  if (!dragged || !target) return scene;
  if (dragged.artboardId !== target.artboardId) return scene;
  if ((dragged.parentId ?? null) !== (target.parentId ?? null)) return scene;

  const ordered =
    side === "before"
      ? [dragged, target]
      : [target, dragged];

  const first = ordered[0];
  const second = ordered[1];

  const gap = 25;
  const paddingX = 16;
  const paddingY = 16;

  const frameId = `auto-layout-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const contentWidth =
    direction === "horizontal"
      ? first.width + second.width + gap
      : Math.max(first.width, second.width);

  const contentHeight =
    direction === "vertical"
      ? first.height + second.height + gap
      : Math.max(first.height, second.height);

  const frame: FrameNode = {
  id: frameId,
  type: "frame",
  name: "Auto Layout",
  artboardId: dragged.artboardId,
  parentId: dragged.parentId ?? null,
  x: Math.min(first.x, second.x) - paddingX,
  y: Math.min(first.y, second.y) - paddingY,
  width: contentWidth + paddingX * 2,
  height: contentHeight + paddingY * 2,

  // Прозорий батьківський контейнер,
  // щоб дочірні фрейми не зливалися в одну пляму
  fill: "rgba(0, 0, 0, 0)",

  stroke: "rgba(0, 0, 0, 0)",
strokeWidth: 0,
  cornerRadius: 12,
  opacity: 1,
  rotation: 0,
  clipContent: true,

  autoLayout: {
    enabled: true,
    direction,
    gap,
    paddingX,
    paddingY,
    align: "start",
    hugContent: true,
  },
};

  const firstChild: SceneNode = {
    ...first,
    parentId: frameId,
    artboardId: frame.artboardId,
  };

  const secondChild: SceneNode = {
    ...second,
    parentId: frameId,
    artboardId: frame.artboardId,
  };

  return {
    ...scene,
    nodes: [
      ...scene.nodes.filter(
        (node) => node.id !== dragged.id && node.id !== target.id
      ),
      frame,
      firstChild,
      secondChild,
    ],
    selection: { kind: "node", id: frameId },
  };
}

export function insertNodeIntoAutoLayoutFrame(
  scene: Scene,
  draggedId: string,
  frameId: string,
  insertIndex: number
): Scene {
  const dragged = findNode(scene, draggedId);
  const frameNode = findNode(scene, frameId);

  if (!dragged || !frameNode || frameNode.type !== "frame") return scene;

  const frame: FrameNode = frameNode;

  if (!frame.autoLayout?.enabled) return scene;
  if (dragged.id === frame.id) return scene;
  if (dragged.artboardId !== frame.artboardId) return scene;
  if (isDescendant(scene, frame.id, dragged.id)) return scene;

  const frameChildren = orderedAutoLayoutChildren(scene, frame).filter(
    (child) => child.id !== dragged.id
  );

  const safeIndex = clamp(insertIndex, 0, frameChildren.length);

  const movedDragged: SceneNode = {
    ...dragged,
    parentId: frame.id,
    artboardId: frame.artboardId,
  };

  const nextChildren = [...frameChildren];
  nextChildren.splice(safeIndex, 0, movedDragged);

  const childrenIds = new Set(frameChildren.map((child) => child.id));

  const baseNodes = scene.nodes.filter(
    (node) => node.id !== dragged.id && !childrenIds.has(node.id)
  );

  const framePosition = baseNodes.findIndex((node) => node.id === frame.id);
  const insertAfterFrame =
    framePosition === -1 ? baseNodes.length : framePosition + 1;

  return {
    ...scene,
    nodes: [
      ...baseNodes.slice(0, insertAfterFrame),
      ...nextChildren,
      ...baseNodes.slice(insertAfterFrame),
    ],
    selection: { kind: "node", id: dragged.id },
  };
}