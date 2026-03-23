import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Arrow,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  RegularPolygon,
  Shape,
  Stage,
  Star,
  Text,
  Transformer,
} from "react-konva";
import Konva from "konva";
import type {
  BackgroundBlurEffect,
  DropShadowEffect,
  FillStyle,
  FrameNode,
  InnerShadowEffect,
  LayerBlurEffect,
  NodeEffect,
  Scene,
  SceneNode,
} from "../types";
import {
  bringNodeForward,
  bringNodeToFront,
  clamp,
  getTopLevelNodes,
  sendNodeBackward,
  sendNodeToBack,
} from "../utils";
import type { Tool } from "../ui/BottomToolbar";

type Props = {
  scene: Scene;
  onChange: (next: Scene) => void;
  tool: Tool;
  zoom: number;
  onZoom: (nextZoom: number) => void;
  onPlace: (artboardId: string, worldX: number, worldY: number) => void;
  onAssignToFrame: (nodeId: string, frameId: string | null) => void;
};

const ACCENT = "#2CA2CA";

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function getGradientPoints(width: number, height: number, angleDeg: number) {
  const angle = degToRad(angleDeg);
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
  const dx = (Math.cos(angle) * len) / 2;
  const dy = (Math.sin(angle) * len) / 2;

  return {
    start: { x: cx - dx, y: cy - dy },
    end: { x: cx + dx, y: cy + dy },
  };
}

function useHTMLImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }

    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    image.src = src;

    return () => {
      setImg(null);
    };
  }, [src]);

  return img;
}

function getImagePatternProps(
  img: HTMLImageElement,
  fit: "cover" | "contain" | "stretch",
  width: number,
  height: number
) {
  if (fit === "stretch") {
    return {
      fillPatternImage: img,
      fillPatternRepeat: "no-repeat" as const,
      fillPatternScaleX: width / img.width,
      fillPatternScaleY: height / img.height,
    };
  }

  if (fit === "contain") {
    const scale = Math.min(width / img.width, height / img.height);
    const cropW = width / scale;
    const cropH = height / scale;

    return {
      fillPatternImage: img,
      fillPatternRepeat: "no-repeat" as const,
      fillPatternScaleX: scale,
      fillPatternScaleY: scale,
      fillPatternOffsetX: Math.max(0, (img.width - cropW) / 2),
      fillPatternOffsetY: Math.max(0, (img.height - cropH) / 2),
    };
  }

  const scale = Math.max(width / img.width, height / img.height);
  const cropW = width / scale;
  const cropH = height / scale;

  return {
    fillPatternImage: img,
    fillPatternRepeat: "no-repeat" as const,
    fillPatternScaleX: scale,
    fillPatternScaleY: scale,
    fillPatternOffsetX: Math.max(0, (img.width - cropW) / 2),
    fillPatternOffsetY: Math.max(0, (img.height - cropH) / 2),
  };
}

function FillRect(props: {
  fillStyle?: FillStyle;
  fallbackFill: string;
  width: number;
  height: number;
  opacity?: number;
  cornerRadius?: number | number[];
  stroke?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  x?: number;
  y?: number;
  listening?: boolean;
  onPointerDown?: any;
  onPointerMove?: any;
  onPointerUp?: any;
  onPointerLeave?: any;
  onContextMenu?: any;
}) {
  const img =
    props.fillStyle?.kind === "image" ? useHTMLImage(props.fillStyle.src) : null;

  const baseRectProps = {
    x: props.x ?? 0,
    y: props.y ?? 0,
    width: props.width,
    height: props.height,
    opacity: props.opacity,
    cornerRadius: props.cornerRadius,
    stroke: props.stroke,
    strokeWidth: props.strokeWidth,
    shadowColor: props.shadowColor,
    shadowBlur: props.shadowBlur,
    shadowOpacity: props.shadowOpacity,
    shadowOffsetX: props.shadowOffsetX,
    shadowOffsetY: props.shadowOffsetY,
    listening: props.listening,
    onPointerDown: props.onPointerDown,
    onPointerMove: props.onPointerMove,
    onPointerUp: props.onPointerUp,
    onPointerLeave: props.onPointerLeave,
    onContextMenu: props.onContextMenu,
  };

  if (props.fillStyle?.kind === "gradient") {
    const pts = getGradientPoints(props.width, props.height, props.fillStyle.angle);
    return (
      <Rect
        {...baseRectProps}
        opacity={props.fillStyle.alpha}
        fillLinearGradientStartPoint={pts.start}
        fillLinearGradientEndPoint={pts.end}
        fillLinearGradientColorStops={[0, props.fillStyle.from, 1, props.fillStyle.to]}
      />
    );
  }

  if (props.fillStyle?.kind === "image" && img) {
    return (
      <Rect
        {...baseRectProps}
        {...getImagePatternProps(img, props.fillStyle.fit, props.width, props.height)}
        opacity={props.fillStyle.opacity}
      />
    );
  }

  if (props.fillStyle?.kind === "solid") {
    return (
      <Rect
        {...baseRectProps}
        fill={props.fillStyle.color}
        opacity={props.fillStyle.alpha}
      />
    );
  }

  return <Rect {...baseRectProps} fill={props.fallbackFill} />;
}

function FillEllipse(props: {
  fillStyle?: FillStyle;
  fallbackFill: string;
  width: number;
  height: number;
  arcPercent: number;
  arcRotation: number;
  holePercent: number;
  centerOffsetPercent: number;
  stroke?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  onContextMenu?: any;
}) {
  const img =
    props.fillStyle?.kind === "image" ? useHTMLImage(props.fillStyle.src) : null;

  const arcAngle = clamp(props.arcPercent, 1, 100) * 3.6;
  const start = degToRad(props.arcRotation);
  const end = degToRad(props.arcRotation + arcAngle);

  const rx = props.width / 2;
  const ry = props.height / 2;

  const innerScale = clamp(props.holePercent, 0, 95) / 100;
  const innerRx = rx * innerScale;
  const innerRy = ry * innerScale;

  const offsetScale = clamp(props.centerOffsetPercent, 0, 80) / 100;
  const offsetDx = Math.cos(start) * rx * offsetScale;
  const offsetDy = Math.sin(start) * ry * offsetScale;

  const commonShapeProps = {
    x: props.width / 2,
    y: props.height / 2,
    stroke: props.stroke,
    strokeWidth: props.strokeWidth,
    shadowColor: props.shadowColor,
    shadowBlur: props.shadowBlur,
    shadowOpacity: props.shadowOpacity,
    shadowOffsetX: props.shadowOffsetX,
    shadowOffsetY: props.shadowOffsetY,
    onContextMenu: props.onContextMenu,
    sceneFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
      ctx.beginPath();

      if (innerScale <= 0.0001) {
        if (arcAngle >= 360) {
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        } else {
          const startX = Math.cos(start) * rx;
          const startY = Math.sin(start) * ry;

          ctx.moveTo(0, 0);
          ctx.lineTo(startX, startY);
          ctx.ellipse(0, 0, rx, ry, 0, start, end, false);
          ctx.closePath();
        }
      } else {
        if (arcAngle >= 360) {
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.moveTo(offsetDx + innerRx, offsetDy);
          ctx.ellipse(offsetDx, offsetDy, innerRx, innerRy, 0, 0, Math.PI * 2, true);
          ctx.closePath();
        } else {
          const outerStartX = Math.cos(start) * rx;
          const outerStartY = Math.sin(start) * ry;

          const innerEndX = offsetDx + Math.cos(end) * innerRx;
          const innerEndY = offsetDy + Math.sin(end) * innerRy;

          ctx.moveTo(outerStartX, outerStartY);
          ctx.ellipse(0, 0, rx, ry, 0, start, end, false);
          ctx.lineTo(innerEndX, innerEndY);
          ctx.ellipse(offsetDx, offsetDy, innerRx, innerRy, 0, end, start, true);
          ctx.closePath();
        }
      }

      ctx.fillStrokeShape(shape);
    },
  };

  if (props.fillStyle?.kind === "gradient") {
    const pts = getGradientPoints(props.width, props.height, props.fillStyle.angle);
    return (
      <Shape
        {...commonShapeProps}
        opacity={props.fillStyle.alpha}
        fillLinearGradientStartPoint={pts.start}
        fillLinearGradientEndPoint={pts.end}
        fillLinearGradientColorStops={[0, props.fillStyle.from, 1, props.fillStyle.to]}
      />
    );
  }

  if (props.fillStyle?.kind === "image" && img) {
    return (
      <Shape
        {...commonShapeProps}
        opacity={props.fillStyle.opacity}
        {...getImagePatternProps(img, props.fillStyle.fit, props.width, props.height)}
      />
    );
  }

  if (props.fillStyle?.kind === "solid") {
    return (
      <Shape
        {...commonShapeProps}
        fill={props.fillStyle.color}
        opacity={props.fillStyle.alpha}
      />
    );
  }

  return <Shape {...commonShapeProps} fill={props.fallbackFill} />;
}

function normalizeCornerRadius(
  cornerRadius: number | number[] | undefined,
  width: number,
  height: number
) {
  const maxRadius = Math.max(0, Math.min(width, height) / 2);

  if (Array.isArray(cornerRadius)) {
    return cornerRadius.map((v) => clamp(Number(v ?? 0), 0, maxRadius));
  }

  return clamp(Number(cornerRadius ?? 0), 0, maxRadius);
}

function getNodeEffects(node: SceneNode): NodeEffect[] {
  return Array.isArray((node as any).effects) ? ((node as any).effects as NodeEffect[]) : [];
}

function getDropShadowEffect(node: SceneNode): DropShadowEffect | undefined {
  return getNodeEffects(node).find(
    (e): e is DropShadowEffect => e.type === "drop-shadow" && e.enabled
  );
}

function getInnerShadowEffect(node: SceneNode): InnerShadowEffect | undefined {
  return getNodeEffects(node).find(
    (e): e is InnerShadowEffect => e.type === "inner-shadow" && e.enabled
  );
}

function getLayerBlurEffect(node: SceneNode): LayerBlurEffect | undefined {
  return getNodeEffects(node).find(
    (e): e is LayerBlurEffect => e.type === "layer-blur" && e.enabled
  );
}

function getBackgroundBlurEffect(node: SceneNode): BackgroundBlurEffect | undefined {
  return getNodeEffects(node).find(
    (e): e is BackgroundBlurEffect => e.type === "background-blur" && e.enabled
  );
}

function getBlurRadius(node: SceneNode) {
  const layer = getLayerBlurEffect(node);
  const background = getBackgroundBlurEffect(node);
  return Math.max(layer?.blur ?? 0, background?.blur ?? 0);
}

function getDropShadowProps(node: SceneNode) {
  const effect = getDropShadowEffect(node);
  if (!effect) return {};

  return {
    shadowColor: effect.color,
    shadowBlur: effect.blur,
    shadowOpacity: effect.alpha,
    shadowOffsetX: effect.x,
    shadowOffsetY: effect.y,
  };
}

function renderInnerShadowRect(
  width: number,
  height: number,
  cornerRadius: number | number[] | undefined,
  effect?: InnerShadowEffect
) {
  if (!effect) return null;

  return (
    <Rect
      x={0}
      y={0}
      width={width}
      height={height}
      cornerRadius={cornerRadius as any}
      listening={false}
      fillEnabled={false}
      stroke={effect.color}
      strokeWidth={Math.max(1, effect.spread || 1)}
      opacity={effect.alpha * 0.55}
      shadowColor={effect.color}
      shadowBlur={effect.blur}
      shadowOpacity={effect.alpha}
      shadowOffsetX={-effect.x * 0.35}
      shadowOffsetY={-effect.y * 0.35}
    />
  );
}

function FillPolygon(props: {
  fillStyle?: FillStyle;
  fallbackFill: string;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  sides: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  onContextMenu?: any;
}) {
  const img =
    props.fillStyle?.kind === "image" ? useHTMLImage(props.fillStyle.src) : null;
  const radius = Math.min(props.width, props.height) / 2;

  if (props.fillStyle?.kind === "gradient") {
    const pts = getGradientPoints(props.width, props.height, props.fillStyle.angle);
    return (
      <RegularPolygon
        x={props.width / 2}
        y={props.height / 2}
        sides={props.sides}
        radius={radius}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOpacity={props.shadowOpacity}
        shadowOffsetX={props.shadowOffsetX}
        shadowOffsetY={props.shadowOffsetY}
        onContextMenu={props.onContextMenu}
        opacity={props.fillStyle.alpha}
        fillLinearGradientStartPoint={pts.start}
        fillLinearGradientEndPoint={pts.end}
        fillLinearGradientColorStops={[0, props.fillStyle.from, 1, props.fillStyle.to]}
      />
    );
  }

  if (props.fillStyle?.kind === "image" && img) {
    return (
      <RegularPolygon
        x={props.width / 2}
        y={props.height / 2}
        sides={props.sides}
        radius={radius}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOpacity={props.shadowOpacity}
        shadowOffsetX={props.shadowOffsetX}
        shadowOffsetY={props.shadowOffsetY}
        onContextMenu={props.onContextMenu}
        opacity={props.fillStyle.opacity}
        {...getImagePatternProps(img, props.fillStyle.fit, props.width, props.height)}
      />
    );
  }

  if (props.fillStyle?.kind === "solid") {
    return (
      <RegularPolygon
        x={props.width / 2}
        y={props.height / 2}
        sides={props.sides}
        radius={radius}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOpacity={props.shadowOpacity}
        shadowOffsetX={props.shadowOffsetX}
        shadowOffsetY={props.shadowOffsetY}
        onContextMenu={props.onContextMenu}
        fill={props.fillStyle.color}
        opacity={props.fillStyle.alpha}
      />
    );
  }

  return (
    <RegularPolygon
      x={props.width / 2}
      y={props.height / 2}
      sides={props.sides}
      radius={radius}
      stroke={props.stroke}
      strokeWidth={props.strokeWidth}
      shadowColor={props.shadowColor}
      shadowBlur={props.shadowBlur}
      shadowOpacity={props.shadowOpacity}
      shadowOffsetX={props.shadowOffsetX}
      shadowOffsetY={props.shadowOffsetY}
      onContextMenu={props.onContextMenu}
      fill={props.fallbackFill}
    />
  );
}

function FillStar(props: {
  fillStyle?: FillStyle;
  fallbackFill: string;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  points: number;
  innerRatioPercent: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  onContextMenu?: any;
}) {
  const img =
    props.fillStyle?.kind === "image" ? useHTMLImage(props.fillStyle.src) : null;
  const outerRadius = Math.min(props.width, props.height) / 2;
  const innerRadius = outerRadius * (clamp(props.innerRatioPercent, 10, 95) / 100);

  if (props.fillStyle?.kind === "gradient") {
    const pts = getGradientPoints(props.width, props.height, props.fillStyle.angle);
    return (
      <Star
        x={props.width / 2}
        y={props.height / 2}
        numPoints={props.points}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOpacity={props.shadowOpacity}
        shadowOffsetX={props.shadowOffsetX}
        shadowOffsetY={props.shadowOffsetY}
        onContextMenu={props.onContextMenu}
        opacity={props.fillStyle.alpha}
        fillLinearGradientStartPoint={pts.start}
        fillLinearGradientEndPoint={pts.end}
        fillLinearGradientColorStops={[0, props.fillStyle.from, 1, props.fillStyle.to]}
      />
    );
  }

  if (props.fillStyle?.kind === "image" && img) {
    return (
      <Star
        x={props.width / 2}
        y={props.height / 2}
        numPoints={props.points}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOpacity={props.shadowOpacity}
        shadowOffsetX={props.shadowOffsetX}
        shadowOffsetY={props.shadowOffsetY}
        onContextMenu={props.onContextMenu}
        opacity={props.fillStyle.opacity}
        {...getImagePatternProps(img, props.fillStyle.fit, props.width, props.height)}
      />
    );
  }

  if (props.fillStyle?.kind === "solid") {
    return (
      <Star
        x={props.width / 2}
        y={props.height / 2}
        numPoints={props.points}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOpacity={props.shadowOpacity}
        shadowOffsetX={props.shadowOffsetX}
        shadowOffsetY={props.shadowOffsetY}
        onContextMenu={props.onContextMenu}
        fill={props.fillStyle.color}
        opacity={props.fillStyle.alpha}
      />
    );
  }

  return (
    <Star
      x={props.width / 2}
      y={props.height / 2}
      numPoints={props.points}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      stroke={props.stroke}
      strokeWidth={props.strokeWidth}
      shadowColor={props.shadowColor}
      shadowBlur={props.shadowBlur}
      shadowOpacity={props.shadowOpacity}
      shadowOffsetX={props.shadowOffsetX}
      shadowOffsetY={props.shadowOffsetY}
      onContextMenu={props.onContextMenu}
      fill={props.fallbackFill}
    />
  );
}

function ImageNodeShape(props: {
  src: string;
  fit: "cover" | "contain" | "stretch";
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  onContextMenu?: any;
}) {
  const img = useHTMLImage(props.src);

  if (!img) {
    return (
      <Group onContextMenu={props.onContextMenu}>
        <Rect
          x={0}
          y={0}
          width={props.width}
          height={props.height}
          fill="#16181d"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          dash={[8, 6]}
          cornerRadius={10}
        />
        <Text
          x={0}
          y={props.height / 2 - 10}
          width={props.width}
          text="Image"
          align="center"
          fill="#cfcfcf"
          fontSize={18}
        />
      </Group>
    );
  }

  let crop;
  if (props.fit === "cover") {
    const aspect = props.width / props.height;
    const imgAspect = img.width / img.height;

    if (aspect >= imgAspect) {
      const newHeight = img.width / aspect;
      crop = {
        x: 0,
        y: (img.height - newHeight) / 2,
        width: img.width,
        height: newHeight,
      };
    } else {
      const newWidth = img.height * aspect;
      crop = {
        x: (img.width - newWidth) / 2,
        y: 0,
        width: newWidth,
        height: img.height,
      };
    }
  }

  return (
    <Group onContextMenu={props.onContextMenu}>
      <KonvaImage
        image={img}
        x={0}
        y={0}
        width={props.width}
        height={props.height}
        crop={props.fit === "cover" ? crop : undefined}
      />
      <Rect
        x={0}
        y={0}
        width={props.width}
        height={props.height}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        cornerRadius={10}
      />
    </Group>
  );
}

function isPointInsideNode(node: SceneNode, x: number, y: number) {
  return x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height;
}

export default function Editor({
  scene,
  onChange,
  tool,
  zoom,
  onZoom,
  onPlace,
  onAssignToFrame,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);

  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const artboardRectRefs = useRef<Record<string, Konva.Rect | null>>({});
  const artboardGroupRefs = useRef<Record<string, Konva.Group | null>>({});

  const canvasActiveRef = useRef(false);

  const isSpaceDown = useRef(false);
  const isPanning = useRef(false);
  const lastPan = useRef<{ x: number; y: number } | null>(null);

  const artboardDragStartRef = useRef<null | {
    artboardId: string;
    startX: number;
    startY: number;
    artboardX: number;
    artboardY: number;
  }>(null);

  const [contextMenu, setContextMenu] = useState<null | {
    x: number;
    y: number;
    nodeId: string;
  }>(null);

  const artboards = scene.artboards ?? [];
  const nodes = scene.nodes ?? [];
  const selection = scene.selection ?? { kind: "none" as const };

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, SceneNode[]>();
    for (const node of nodes) {
      const key = node.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    }
    return map;
  }, [nodes]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const apply = () => {
      const r = el.getBoundingClientRect();
      setSize({
        w: Math.max(300, Math.floor(r.width)),
        h: Math.max(300, Math.floor(r.height)),
      });
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function focusStage() {
    const stage = stageRef.current;
    if (!stage) return;
    const c = stage.container();
    c.tabIndex = 0;
    c.style.outline = "none";
    c.focus();
    canvasActiveRef.current = true;
  }

  function setSelection(sel: Scene["selection"]) {
    onChange({ ...scene, selection: sel });
  }

  function deleteSelection() {
    if (selection.kind === "node") {
      const removingId = selection.id;
      const toRemove = new Set<string>([removingId]);

      let changed = true;
      while (changed) {
        changed = false;
        for (const n of nodes) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id);
            changed = true;
          }
        }
      }

      onChange({
        ...scene,
        nodes: nodes.filter((n) => !toRemove.has(n.id)),
        selection: { kind: "none" },
      });
      return;
    }

    if (selection.kind === "artboard") {
      const abId = selection.id;
      onChange({
        ...scene,
        artboards: artboards.filter((a) => a.id !== abId),
        nodes: nodes.filter((n) => n.artboardId !== abId),
        selection: { kind: "none" },
      });
    }
  }

  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;

    if (selection.kind === "node") {
      const n = nodeRefs.current[selection.id];
      tr.nodes(n ? [n] : []);
    } else if (selection.kind === "artboard") {
      const r = artboardRectRefs.current[selection.id];
      tr.nodes(r ? [r] : []);
    } else {
      tr.nodes([]);
    }

    tr.moveToTop();
    layer.batchDraw();
  }, [selection, nodes.length, artboards.length]);

  

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceDown.current = true;
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceDown.current = false;
        isPanning.current = false;
        lastPan.current = null;
      }
    };

    function isTypingTarget(el: Element | null) {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (el as HTMLElement).isContentEditable
      );
    }

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return;
      if (!canvasActiveRef.current) return;

      if (e.key === "Delete" || e.key === "Backspace") deleteSelection();
      if (e.key === "Escape") {
        setSelection({ kind: "none" });
        setContextMenu(null);
      }
    };

    const onPointerDownAnywhere = (ev: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (!stage.container().contains(ev.target as Node)) {
        canvasActiveRef.current = false;
        setContextMenu(null);
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDownAnywhere, true);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDownAnywhere, true);
    };
  }, [scene, selection, artboards, nodes]);

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = stage.scaleX();

    if (e.evt.ctrlKey) {
      const zoomSpeed = 0.0035;
      const newScale = clamp(oldScale * Math.exp(-e.evt.deltaY * zoomSpeed), 0.25, 3);

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });

      stage.batchDraw();
      onZoom(newScale);
      return;
    }

    stage.position({
      x: stage.x() - e.evt.deltaX,
      y: stage.y() - e.evt.deltaY,
    });

    stage.batchDraw();
  }

  function onStagePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    focusStage();
    setContextMenu(null);

    if (isSpaceDown.current || tool === "hand") {
      isPanning.current = true;
      const p = stageRef.current?.getPointerPosition();
      if (p) lastPan.current = { x: p.x, y: p.y };
      return;
    }

    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelection({ kind: "none" });
  }

  function onStagePointerMove() {
    if (!isPanning.current) return;
    const stage = stageRef.current;
    if (!stage) return;

    const p = stage.getPointerPosition();
    if (!p || !lastPan.current) return;

    stage.position({
      x: stage.x() + (p.x - lastPan.current.x),
      y: stage.y() + (p.y - lastPan.current.y),
    });
    stage.batchDraw();
    lastPan.current = { x: p.x, y: p.y };
  }

  function onStagePointerUp() {
    isPanning.current = false;
    lastPan.current = null;
  }

  function getWorldPointer() {
    const stage = stageRef.current;
    if (!stage) return null;
    const p = stage.getPointerPosition();
    if (!p) return null;
    const scale = stage.scaleX();

    return {
      x: (p.x - stage.x()) / scale,
      y: (p.y - stage.y()) / scale,
    };
  }

  function stopBubble(e: any) {
    e.cancelBubble = true;
  }

  function moveArtboardVisual(abId: string, x: number, y: number) {
    const g = artboardGroupRefs.current[abId];
    if (g) {
      g.position({ x, y });
      g.getLayer()?.batchDraw();
    }
  }

  function handleNodeContextMenu(e: any, nodeId: string) {
    e.evt.preventDefault();
    stopBubble(e);
    focusStage();

    setSelection({ kind: "node", id: nodeId });

    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      nodeId,
    });
  }

 function renderNode(
  node: SceneNode,
  ab: { x: number; y: number; width: number; height: number },
  visited = new Set<string>()
): React.ReactNode {
  if (visited.has(node.id)) {
    return null;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(node.id);

  const localX = node.x - ab.x;
  const localY = node.y - ab.y;
  const isNodeSelected = selection.kind === "node" && selection.id === node.id;
  const dropShadowProps = getDropShadowProps(node);
  const innerShadowEffect = getInnerShadowEffect(node);

  const children = (childrenMap.get(node.id) ?? []).filter((child) => child.id !== node.id);

  const commonEvents = {
    onContextMenu: (e: any) => handleNodeContextMenu(e, node.id),
  };

  const content = (
    <>
      {(node.type === "rect" || node.type === "frame") && (
        <>
          <FillRect
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            fallbackFill={node.fill}
            fillStyle={node.fillStyle}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth}
            cornerRadius={normalizeCornerRadius(node.cornerRadius, node.width, node.height)}
            {...dropShadowProps}
            {...commonEvents}
          />
          {renderInnerShadowRect(
            node.width,
            node.height,
            normalizeCornerRadius(node.cornerRadius, node.width, node.height),
            innerShadowEffect
          )}
        </>
      )}

      {node.type === "text" && (
        <>
          <Rect
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            fill={node.backgroundColor || "#ffffff"}
            cornerRadius={8}
            {...dropShadowProps}
            {...commonEvents}
          />

          <Text
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            text={node.text}
            fill={node.color}
            fontSize={node.fontSize}
            fontFamily={node.fontFamily}
            fontStyle={node.fontStyle === "italic" ? "italic" : "normal"}
            fontVariant={node.fontWeight >= 600 ? "small-caps" : undefined}
            fontWeight={String(node.fontWeight)}
            align={node.align}
            verticalAlign="top"
            padding={node.padding ?? 12}
            lineHeight={node.lineHeight ?? 1.2}
            letterSpacing={node.letterSpacing ?? 0}
            wrap={node.wrap ?? "word"}
            ellipsis={false}
            {...commonEvents}
          />

          {renderInnerShadowRect(node.width, node.height, 8, innerShadowEffect)}
        </>
      )}

      {node.type === "line" && (
        <Line
          points={[0, node.height, node.width, 0]}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          lineCap="round"
          lineJoin="round"
          {...dropShadowProps}
          {...commonEvents}
        />
      )}

      {node.type === "arrow" && (
        <Arrow
          points={[0, node.height, node.width, 0]}
          stroke={node.stroke}
          fill={node.stroke}
          strokeWidth={node.strokeWidth}
          pointerLength={14}
          pointerWidth={14}
          lineCap="round"
          lineJoin="round"
          {...dropShadowProps}
          {...commonEvents}
        />
      )}

      {node.type === "ellipse" && (
        <FillEllipse
          width={node.width}
          height={node.height}
          arcPercent={node.arcPercent ?? 100}
          arcRotation={node.arcRotation ?? 0}
          holePercent={node.holePercent ?? 0}
          centerOffsetPercent={node.centerOffsetPercent ?? 0}
          fallbackFill={node.fill}
          fillStyle={node.fillStyle}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          {...dropShadowProps}
          {...commonEvents}
        />
      )}

      {node.type === "polygon" && (
        <FillPolygon
          width={node.width}
          height={node.height}
          fallbackFill={node.fill}
          fillStyle={node.fillStyle}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          sides={node.sides}
          {...dropShadowProps}
          {...commonEvents}
        />
      )}

      {node.type === "star" && (
        <FillStar
          width={node.width}
          height={node.height}
          fallbackFill={node.fill}
          fillStyle={node.fillStyle}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          points={node.points}
          innerRatioPercent={node.innerRatioPercent}
          {...dropShadowProps}
          {...commonEvents}
        />
      )}

      {node.type === "image" && (
        <ImageNodeShape
          src={node.src}
          fit={node.fit}
          width={node.width}
          height={node.height}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          {...commonEvents}
        />
      )}

      {!isNodeSelected && (
        <Rect
          x={0}
          y={0}
          width={Math.max(node.width, 8)}
          height={Math.max(node.height, 8)}
          listening={false}
          opacity={0}
        />
      )}
    </>
  );

  return (
    <Group
      key={node.id}
      x={localX}
      y={localY}
      rotation={node.rotation ?? 0}
      opacity={node.opacity ?? 1}
      draggable={tool === "select" && !(isSpaceDown.current || tool === "hand")}
      dragDistance={0}
      onPointerDown={(e: any) => {
        stopBubble(e);
        focusStage();
        setSelection({ kind: "node", id: node.id });
        setContextMenu(null);
      }}
      onMouseDown={(e: any) => {
        stopBubble(e);
        focusStage();
        setSelection({ kind: "node", id: node.id });
        setContextMenu(null);
      }}
      onTouchStart={(e: any) => {
        stopBubble(e);
        focusStage();
        setSelection({ kind: "node", id: node.id });
        setContextMenu(null);
      }}
      onDragStart={(e: any) => {
        stopBubble(e);
        setContextMenu(null);
      }}
      onDragMove={(e: any) => {
        stopBubble(e);
      }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        const t = e.target as Konva.Group;

        const worldX = ab.x + t.x();
        const worldY = ab.y + t.y();

        onChange({
          ...scene,
          nodes: nodes.map((n) =>
            n.id === node.id
              ? ({
                  ...n,
                  x: worldX,
                  y: worldY,
                } as SceneNode)
              : n
          ),
        });
      }}
      onTransformStart={(e: any) => {
        stopBubble(e);
      }}
      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
        const target = e.target as Konva.Group;
        const scaleX = target.scaleX();
        const scaleY = target.scaleY();

        target.scaleX(1);
        target.scaleY(1);

        const isTextNode = node.type === "text";

        const newW = clamp(node.width * scaleX, 10, 5000);
        const newH = isTextNode
          ? clamp(node.height * scaleY, 24, 5000)
          : clamp(node.height * scaleY, 10, 5000);

        onChange({
          ...scene,
          nodes: nodes.map((n) =>
            n.id === node.id
              ? ({
                  ...n,
                  x: ab.x + target.x(),
                  y: ab.y + target.y(),
                  width: newW,
                  height: newH,
                  rotation: target.rotation(),
                } as SceneNode)
              : n
          ),
        });
      }}
      ref={(ref: any) => {
        nodeRefs.current[node.id] = ref;
      }}
    >
      {content}
    </Group>
  );
}

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <Stage
        ref={(r) => (stageRef.current = r)}
        width={size.w}
        height={size.h}
        tabIndex={0}
        style={{ outline: "none", background: "#1e1e1e", touchAction: "none" as any }}
        scaleX={zoom}
        scaleY={zoom}
        onWheel={handleWheel}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
      >
        <Layer ref={(r) => (layerRef.current = r)}>
          {artboards.map((ab) => {
            const isSelected = selection.kind === "artboard" && selection.id === ab.id;
            const abNodes = getTopLevelNodes(scene, ab.id);

            const canDragSelectedArtboard =
              tool === "select" &&
              !(isSpaceDown.current || tool === "hand") &&
              selection.kind === "artboard" &&
              selection.id === ab.id;

            return (
              <Group
                key={ab.id}
                x={ab.x}
                y={ab.y}
                ref={(ref) => {
                  artboardGroupRefs.current[ab.id] = ref;
                }}
              >
                <Text
                  x={0}
                  y={-22}
                  text={ab.name}
                  fill={isSelected ? ACCENT : "#b8b8b8"}
                  fontSize={14}
                  listening={true}
                  onPointerDown={(ev) => {
                    stopBubble(ev);
                    focusStage();
                    setSelection({ kind: "artboard", id: ab.id });
                    setContextMenu(null);
                  }}
                />

                <FillRect
                  x={0}
                  y={0}
                  width={ab.width}
                  height={ab.height}
                  fallbackFill={ab.fill}
                  fillStyle={ab.fillStyle}
                  stroke={isSelected ? ACCENT : ab.stroke}
                  strokeWidth={isSelected ? 2 : 1}
                  cornerRadius={2}
                  shadowColor="black"
                  shadowBlur={10}
                  shadowOpacity={0.12}
                  onPointerDown={(ev: any) => {
                    focusStage();
                    setContextMenu(null);

                    if (tool !== "select" && tool !== "hand") {
                      ev.cancelBubble = true;
                      const wp = getWorldPointer();
                      if (wp) onPlace(ab.id, wp.x, wp.y);
                      return;
                    }

                    ev.cancelBubble = true;
                    setSelection({ kind: "artboard", id: ab.id });

                    if (canDragSelectedArtboard) {
                      const stage = stageRef.current;
                      const p = stage?.getPointerPosition();
                      if (!p) return;

                      artboardDragStartRef.current = {
                        artboardId: ab.id,
                        startX: p.x,
                        startY: p.y,
                        artboardX: ab.x,
                        artboardY: ab.y,
                      };
                    }
                  }}
                  onPointerMove={() => {
                    if (!canDragSelectedArtboard) return;

                    const info = artboardDragStartRef.current;
                    if (!info || info.artboardId !== ab.id) return;

                    const stage = stageRef.current;
                    const p = stage?.getPointerPosition();
                    if (!p) return;

                    const scale = stage?.scaleX() || 1;
                    const dx = (p.x - info.startX) / scale;
                    const dy = (p.y - info.startY) / scale;

                    moveArtboardVisual(ab.id, info.artboardX + dx, info.artboardY + dy);
                  }}
                  onPointerUp={() => {
                    const info = artboardDragStartRef.current;
                    if (!info || info.artboardId !== ab.id) return;

                    const stage = stageRef.current;
                    const p = stage?.getPointerPosition();
                    if (!p) {
                      artboardDragStartRef.current = null;
                      return;
                    }

                    const scale = stage?.scaleX() || 1;
                    const dx = (p.x - info.startX) / scale;
                    const dy = (p.y - info.startY) / scale;

                    const nextX = info.artboardX + dx;
                    const nextY = info.artboardY + dy;

                    artboardDragStartRef.current = null;

                    onChange({
                      ...scene,
                      artboards: artboards.map((a) =>
                        a.id === ab.id ? { ...a, x: nextX, y: nextY } : a
                      ),
                      nodes: nodes.map((n) =>
                        n.artboardId === ab.id
                          ? ({ ...n, x: n.x + dx, y: n.y + dy } as SceneNode)
                          : n
                      ),
                    });
                  }}
                  onPointerLeave={() => {
                    const info = artboardDragStartRef.current;
                    if (info?.artboardId === ab.id) {
                      artboardDragStartRef.current = null;
                    }
                  }}
                />

                <Group clipX={0} clipY={0} clipWidth={ab.width} clipHeight={ab.height}>
                  {abNodes.map((node) => renderNode(node, ab))}
                </Group>

                <Rect
                  ref={(ref) => {
                    artboardRectRefs.current[ab.id] = ref;
                  }}
                  x={0}
                  y={0}
                  width={ab.width}
                  height={ab.height}
                  opacity={0}
                  listening={false}
                />
              </Group>
            );
          })}

          <Transformer
            ref={(r) => (trRef.current = r)}
            rotateEnabled={selection.kind === "node"}
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            borderStroke={ACCENT}
            borderStrokeWidth={1}
            borderDash={[]}
            padding={2}
            anchorSize={7}
            anchorCornerRadius={2}
            anchorStroke={ACCENT}
            anchorStrokeWidth={1}
            anchorFill="#1e1e1e"
            rotateAnchorOffset={22}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {contextMenu && (
        <div
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 9999,
            background: "#2b2b2b",
            border: "1px solid #444",
            borderRadius: 10,
            padding: 6,
            minWidth: 180,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            style={menuBtnStyle}
            onClick={() => {
              onChange(bringNodeToFront(scene, contextMenu.nodeId));
              setContextMenu(null);
            }}
          >
            Bring to front
          </button>

          <button
            style={menuBtnStyle}
            onClick={() => {
              onChange(bringNodeForward(scene, contextMenu.nodeId));
              setContextMenu(null);
            }}
          >
            Bring forward
          </button>

          <button
            style={menuBtnStyle}
            onClick={() => {
              onChange(sendNodeBackward(scene, contextMenu.nodeId));
              setContextMenu(null);
            }}
          >
            Send backward
          </button>

          <button
            style={menuBtnStyle}
            onClick={() => {
              onChange(sendNodeToBack(scene, contextMenu.nodeId));
              setContextMenu(null);
            }}
          >
            Send to back
          </button>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "transparent",
  color: "#f2f2f2",
  border: "none",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 8,
  cursor: "pointer",
};