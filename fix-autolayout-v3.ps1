# fix-autolayout-v3.ps1
#     unix-lite-editor,       .
#     ,  package.json,  :
# powershell -ExecutionPolicy Bypass -File .\fix-autolayout-v3.ps1

$ErrorActionPreference = "Stop"

function Assert-File([string]$Path) {
    if (!(Test-Path $Path)) {
        throw "  : $Path.      unix-lite-editor."
    }
}

function Backup-File([string]$Path) {
    $backup = "$Path.autolayout-v3.bak"
    Copy-Item $Path $backup -Force
    Write-Host "Backup : $backup"
}

function Replace-OnceLiteral([string]$Text, [string]$Old, [string]$New, [string]$Label) {
    if (-not $Text.Contains($Old)) {
        throw "    : $Label"
    }
    return $Text.Replace($Old, $New)
}

function Replace-OnceRegex([string]$Text, [string]$Pattern, [string]$Replacement, [string]$Label) {
    $regex = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    $matches = $regex.Matches($Text)
    if ($matches.Count -lt 1) {
        throw "  regex-  : $Label"
    }
    if ($matches.Count -gt 1) {
        Write-Host ":  '$Label'  $($matches.Count) ,  ."
    }
    return $regex.Replace($Text, $Replacement, 1)
}

$appPath = "src\App.tsx"
$utilsPath = "src\utils.ts"
$editorPath = "src\editor\Editor.tsx"

Assert-File $appPath
Assert-File $utilsPath
Assert-File $editorPath

Backup-File $appPath
Backup-File $utilsPath
Backup-File $editorPath

# -----------------------------------------------------------------------------
# 1. App.tsx    scene    auto-layout
# -----------------------------------------------------------------------------
$app = Get-Content $appPath -Raw

$oldCommit = 'function commitScene(next: Scene | ((prev: Scene) => Scene)) { setScene((prev) => (typeof next === "function" ? next(prev) : next)); }'
$newCommit = 'function commitScene(next: Scene | ((prev: Scene) => Scene)) { setScene((prev) => { const resolved = typeof next === "function" ? next(prev) : next; return finalizeScene(resolved); }); }'

$app = Replace-OnceLiteral $app $oldCommit $newCommit "App.tsx / commitScene"
Set-Content $appPath $app -Encoding UTF8
Write-Host "App.tsx ."

# -----------------------------------------------------------------------------
# 2. utils.ts    , '    Auto Layout
# -----------------------------------------------------------------------------
$utils = Get-Content $utilsPath -Raw

$newUtilsTail = @'
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

const AUTO_LAYOUT_SNAP_DISTANCE = 48;
const AUTO_LAYOUT_FRAME_HOVER_PADDING = 28;

function centerOf(node: SceneNode) {
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

function overlapLength(a1: number, a2: number, b1: number, b2: number) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function axisGap(
  a: SceneNode,
  b: SceneNode,
  direction: AutoLayoutDropDirection
) {
  if (direction === "horizontal") {
    if (a.x + a.width <= b.x) return b.x - (a.x + a.width);
    if (b.x + b.width <= a.x) return a.x - (b.x + b.width);
    return 0;
  }

  if (a.y + a.height <= b.y) return b.y - (a.y + a.height);
  if (b.y + b.height <= a.y) return a.y - (b.y + b.height);
  return 0;
}

function unionPreview(a: SceneNode, b: SceneNode, padding = 16) {
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

function mergeInsertLine(
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

function frameChildrenOrdered(scene: Scene, frame: FrameNode) {
  const direction =
    frame.autoLayout?.direction === "vertical" ? "vertical" : "horizontal";

  return scene.nodes
    .filter((node) => node.parentId === frame.id)
    .sort((a, b) =>
      direction === "horizontal" ? a.x - b.x : a.y - b.y
    );
}

function insertionIndexForFrame(
  frame: FrameNode,
  children: SceneNode[],
  dragged: SceneNode
) {
  const direction =
    frame.autoLayout?.direction === "vertical" ? "vertical" : "horizontal";
  const draggedCenter = centerOf(dragged);

  if (direction === "horizontal") {
    const index = children.findIndex(
      (child) => draggedCenter.x < centerOf(child).x
    );
    return index === -1 ? children.length : index;
  }

  const index = children.findIndex(
    (child) => draggedCenter.y < centerOf(child).y
  );
  return index === -1 ? children.length : index;
}

function frameInsertLine(
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
  const sourceDragged = findNode(scene, draggedId);
  if (!sourceDragged) return null;

  const dragged = {
    ...sourceDragged,
    x: worldX,
    y: worldY,
  } as SceneNode;

  const draggedCenter = centerOf(dragged);

  const autoFrames = scene.nodes
    .filter(
      (node): node is FrameNode =>
        node.type === "frame" &&
        node.id !== dragged.id &&
        node.artboardId === dragged.artboardId &&
        !!node.autoLayout?.enabled &&
        !isDescendant(scene, node.id, dragged.id)
    )
    .sort((a, b) => a.width * a.height - b.width * b.height);

  for (const frame of autoFrames) {
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

    const children = frameChildrenOrdered(scene, frame).filter(
      (child) => child.id !== dragged.id
    );
    const insertIndex = insertionIndexForFrame(frame, children, dragged);
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
      insertLine: frameInsertLine(frame, children, insertIndex),
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
    if (target.type === "frame" && target.autoLayout?.enabled) continue;

    const targetCenter = centerOf(target);

    const horizontalGap = axisGap(dragged, target, "horizontal");
    const verticalGap = axisGap(dragged, target, "vertical");

    const horizontalCrossOverlap = overlapLength(
      dragged.y,
      dragged.y + dragged.height,
      target.y,
      target.y + target.height
    );

    const verticalCrossOverlap = overlapLength(
      dragged.x,
      dragged.x + dragged.width,
      target.x,
      target.x + target.width
    );

    const horizontalCentersClose =
      Math.abs(draggedCenter.y - targetCenter.y) <=
      Math.max(dragged.height, target.height) * 0.65 +
        AUTO_LAYOUT_SNAP_DISTANCE;

    const verticalCentersClose =
      Math.abs(draggedCenter.x - targetCenter.x) <=
      Math.max(dragged.width, target.width) * 0.65 +
        AUTO_LAYOUT_SNAP_DISTANCE;

    if (
      horizontalGap <= AUTO_LAYOUT_SNAP_DISTANCE &&
      (horizontalCrossOverlap > 0 || horizontalCentersClose)
    ) {
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

    if (
      verticalGap <= AUTO_LAYOUT_SNAP_DISTANCE &&
      (verticalCrossOverlap > 0 || verticalCentersClose)
    ) {
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
    previewRect: unionPreview(dragged, best.target),
    insertLine: mergeInsertLine(
      dragged,
      best.target,
      best.direction,
      best.side
    ),
  };
}

function pairGap(
  first: SceneNode,
  second: SceneNode,
  direction: AutoLayoutDropDirection
) {
  if (direction === "horizontal") {
    return clamp(Math.round(second.x - (first.x + first.width)), 0, 200);
  }

  return clamp(Math.round(second.y - (first.y + first.height)), 0, 200);
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
  if (dragged.id === target.id) return scene;
  if (dragged.artboardId !== target.artboardId) return scene;
  if ((dragged.parentId ?? null) !== (target.parentId ?? null)) return scene;

  const ordered =
    side === "before" ? [dragged, target] : [target, dragged];
  const first = ordered[0];
  const second = ordered[1];

  const gap = pairGap(first, second, direction);
  const paddingX = 16;
  const paddingY = 16;

  const contentWidth =
    direction === "horizontal"
      ? first.width + second.width + gap
      : Math.max(first.width, second.width);

  const contentHeight =
    direction === "vertical"
      ? first.height + second.height + gap
      : Math.max(first.height, second.height);

  const frameId = `auto-layout-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const frame: FrameNode = {
    id: frameId,
    type: "frame",
    artboardId: dragged.artboardId,
    parentId: dragged.parentId ?? null,
    name: "Auto Layout",
    x: Math.min(first.x, second.x) - paddingX,
    y: Math.min(first.y, second.y) - paddingY,
    width: Math.max(40, contentWidth + paddingX * 2),
    height: Math.max(40, contentHeight + paddingY * 2),
    fill: "#25282f",
    stroke: "#2CA2CA",
    strokeWidth: 1,
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

  const nextNodes = scene.nodes.filter(
    (node) => node.id !== dragged.id && node.id !== target.id
  );

  const firstChild = {
    ...first,
    parentId: frameId,
    artboardId: frame.artboardId,
  } as SceneNode;

  const secondChild = {
    ...second,
    parentId: frameId,
    artboardId: frame.artboardId,
  } as SceneNode;

  return {
    ...scene,
    nodes: [...nextNodes, frame, firstChild, secondChild],
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
  const frame = findNode(scene, frameId);

  if (!dragged || !frame || frame.type !== "frame") return scene;
  if (!frame.autoLayout?.enabled) return scene;
  if (dragged.id === frame.id) return scene;
  if (dragged.artboardId !== frame.artboardId) return scene;
  if (isDescendant(scene, frame.id, dragged.id)) return scene;

  const frameChildren = frameChildrenOrdered(scene, frame).filter(
    (child) => child.id !== dragged.id
  );

  const normalizedIndex = clamp(insertIndex, 0, frameChildren.length);

  const updatedDragged = {
    ...dragged,
    parentId: frame.id,
    artboardId: frame.artboardId,
  } as SceneNode;

  const orderedChildren = [...frameChildren];
  orderedChildren.splice(normalizedIndex, 0, updatedDragged);

  const childIds = new Set(frameChildren.map((child) => child.id));

  const baseNodes = scene.nodes.filter(
    (node) => node.id !== dragged.id && !childIds.has(node.id)
  );

  const frameIndex = baseNodes.findIndex((node) => node.id === frame.id);
  const insertAfterFrame = frameIndex === -1 ? baseNodes.length : frameIndex + 1;

  return {
    ...scene,
    nodes: [
      ...baseNodes.slice(0, insertAfterFrame),
      ...orderedChildren,
      ...baseNodes.slice(insertAfterFrame),
    ],
    selection: { kind: "node", id: dragged.id },
  };
}

function shiftDescendants(
  nodes: SceneNode[],
  parentId: string,
  dx: number,
  dy: number
) {
  for (const node of nodes) {
    if (node.parentId !== parentId) continue;

    node.x += dx;
    node.y += dy;

    shiftDescendants(nodes, node.id, dx, dy);
  }
}

export function applyAutoLayoutToScene(scene: Scene): Scene {
  const nextNodes = scene.nodes.map((node) => ({ ...node })) as SceneNode[];
  const byId = new Map(nextNodes.map((node) => [node.id, node]));
  const processed = new Set<string>();

  function childrenOf(parentId: string) {
    return nextNodes.filter((node) => node.parentId === parentId);
  }

  function layoutFrame(frameId: string) {
    if (processed.has(frameId)) return;

    const maybeFrame = byId.get(frameId);
    if (!maybeFrame || maybeFrame.type !== "frame") return;

    const frame = maybeFrame as FrameNode;
    processed.add(frameId);

    const childrenBeforeLayout = childrenOf(frame.id);
    for (const child of childrenBeforeLayout) {
      if (child.type === "frame") {
        layoutFrame(child.id);
      }
    }

    frame.autoLayout = normalizeAutoLayout(frame.autoLayout);
    if (!frame.autoLayout?.enabled) return;

    const children = childrenOf(frame.id);
    if (children.length === 0) return;

    const layout = frame.autoLayout;

    const placeChildren = () => {
      let cursor = 0;

      if (layout.direction === "horizontal") {
        for (const child of children) {
          const nextX = frame.x + layout.paddingX + cursor;
          const nextY =
            frame.y +
            alignCross(layout.align, frame.height, child.height, layout.paddingY);

          const dx = nextX - child.x;
          const dy = nextY - child.y;

          child.x = nextX;
          child.y = nextY;

          shiftDescendants(nextNodes, child.id, dx, dy);

          cursor += child.width + layout.gap;
        }

        return;
      }

      for (const child of children) {
        const nextX =
          frame.x +
          alignCross(layout.align, frame.width, child.width, layout.paddingX);
        const nextY = frame.y + layout.paddingY + cursor;

        const dx = nextX - child.x;
        const dy = nextY - child.y;

        child.x = nextX;
        child.y = nextY;

        shiftDescendants(nextNodes, child.id, dx, dy);

        cursor += child.height + layout.gap;
      }
    };

    placeChildren();

    if (layout.hugContent) {
      if (layout.direction === "horizontal") {
        const contentWidth =
          layout.paddingX * 2 +
          children.reduce((sum, child) => sum + child.width, 0) +
          layout.gap * Math.max(0, children.length - 1);

        const contentHeight =
          layout.paddingY * 2 +
          Math.max(...children.map((child) => child.height));

        frame.width = Math.max(40, contentWidth);
        frame.height = Math.max(40, contentHeight);
      } else {
        const contentWidth =
          layout.paddingX * 2 +
          Math.max(...children.map((child) => child.width));

        const contentHeight =
          layout.paddingY * 2 +
          children.reduce((sum, child) => sum + child.height, 0) +
          layout.gap * Math.max(0, children.length - 1);

        frame.width = Math.max(40, contentWidth);
        frame.height = Math.max(40, contentHeight);
      }

      placeChildren();
    }
  }

  for (const node of nextNodes) {
    if (node.type === "frame") {
      layoutFrame(node.id);
    }
  }

  return {
    ...scene,
    nodes: nextNodes,
  };
}
'@

$utils = Replace-OnceRegex `
    $utils `
    'export function applyAutoLayoutToScene\(scene: Scene\): Scene \{.*$' `
    $newUtilsTail `
    "utils.ts / applyAutoLayoutToScene +  helper-"

Set-Content $utilsPath $utils -Encoding UTF8
Write-Host "utils.ts ."

# -----------------------------------------------------------------------------
# 3. Editor.tsx  live preview, drop merge, insert into existing Auto Layout
# -----------------------------------------------------------------------------
$editor = Get-Content $editorPath -Raw

$oldImport = 'import { bringNodeForward, bringNodeToFront, clamp, getTopLevelNodes, sendNodeBackward, sendNodeToBack, } from "../utils";'
$newImport = 'import { bringNodeForward, bringNodeToFront, clamp, createAutoLayoutFrameFromDrop, findAutoLayoutDropCandidate, getTopLevelNodes, insertNodeIntoAutoLayoutFrame, sendNodeBackward, sendNodeToBack, } from "../utils";'
$editor = Replace-OnceLiteral $editor $oldImport $newImport "Editor.tsx / utils import"

$oldContextState = 'const [contextMenu, setContextMenu] = useState(null);'
$newContextState = 'const [contextMenu, setContextMenu] = useState(null); const [autoLayoutPreview, setAutoLayoutPreview] = useState<ReturnType<typeof findAutoLayoutDropCandidate>>(null);'
$editor = Replace-OnceLiteral $editor $oldContextState $newContextState "Editor.tsx / autoLayoutPreview state"

$newDragHandlers = @'
onDragStart={(e: any) => { stopBubble(e); setContextMenu(null); setAutoLayoutPreview(null); }} onDragMove={(e: any) => { stopBubble(e); const t = e.target as Konva.Group; const worldX = ab.x + t.x(); const worldY = ab.y + t.y(); setAutoLayoutPreview(findAutoLayoutDropCandidate(scene, node.id, worldX, worldY)); }} onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => { const t = e.target as Konva.Group; const worldX = ab.x + t.x(); const worldY = ab.y + t.y(); const movedScene: Scene = { ...scene, nodes: nodes.map((n) => n.id === node.id ? ({ ...n, x: worldX, y: worldY, } as SceneNode) : n ), }; const candidate = findAutoLayoutDropCandidate(movedScene, node.id, worldX, worldY) ?? autoLayoutPreview; if (candidate?.kind === "merge") { onChange(createAutoLayoutFrameFromDrop(movedScene, candidate.draggedId, candidate.targetId, candidate.direction, candidate.side)); } else if (candidate?.kind === "insert") { onChange(insertNodeIntoAutoLayoutFrame(movedScene, candidate.draggedId, candidate.frameId, candidate.insertIndex)); } else { onChange(movedScene); } setAutoLayoutPreview(null); }}
'@

$editor = Replace-OnceRegex `
    $editor `
    'onDragStart=\{\(e: any\) => \{.*?\}\}\s*onDragMove=\{\(e: any\) => \{.*?\}\}\s*onDragEnd=\{\(e: Konva\.KonvaEventObject(?:<DragEvent>)?\) => \{.*?\}\}\s*(?=onTransformStart=)' `
    $newDragHandlers `
    "Editor.tsx / drag handlers"

$previewMarkup = @'
{autoLayoutPreview && ( <> <Rect x={autoLayoutPreview.previewRect.x} y={autoLayoutPreview.previewRect.y} width={autoLayoutPreview.previewRect.width} height={autoLayoutPreview.previewRect.height} stroke={ACCENT} strokeWidth={2} dash={[8, 5]} cornerRadius={12} listening={false} /> <Line points={[ autoLayoutPreview.insertLine.x1, autoLayoutPreview.insertLine.y1, autoLayoutPreview.insertLine.x2, autoLayoutPreview.insertLine.y2, ]} stroke={ACCENT} strokeWidth={3} lineCap="round" listening={false} /> </> )} <Transformer
'@

$editor = Replace-OnceRegex `
    $editor `
    '<Transformer' `
    $previewMarkup `
    "Editor.tsx / preview before Transformer"

Set-Content $editorPath $editor -Encoding UTF8
Write-Host "Editor.tsx ."

Write-Host ""
Write-Host "."
Write-Host " :"
Write-Host "  npm run dev"
Write-Host ""
Write-Host ":"
Write-Host "1.   '."
Write-Host "2.     ."
Write-Host "3.  '    ."
Write-Host "4.    Auto Layout Frame."
Write-Host "5.  '     frame."
