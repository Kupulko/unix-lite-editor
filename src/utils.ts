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