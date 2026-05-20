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
  createAutoLayoutFrameFromDrop,
  findAutoLayoutDropCandidate,
  getTopLevelNodes,
  insertNodeIntoAutoLayoutFrame,
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

type ResizePreview = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextResizeDraft = {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};
const ALIGN_GUIDE_COLOR = "#ff4d3d";
const ALIGN_GUIDE_PIXEL_THRESHOLD = 6;

type AlignmentGuide = {
  orientation: "vertical" | "horizontal";
  position: number;
  from: number;
  to: number;
};

type SnapResult = {
  x: number;
  y: number;
  guides: AlignmentGuide[];
};

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

function getBounds(
  node: Pick<SceneNode, "x" | "y" | "width" | "height">,
  x = node.x,
  y = node.y
) {
  return {
    left: x,
    right: x + node.width,
    centerX: x + node.width / 2,
    top: y,
    bottom: y + node.height,
    centerY: y + node.height / 2,
  };
}

function getAlignmentSnap(
  scene: Scene,
  movingNode: SceneNode,
  artboard: { x: number; y: number; width: number; height: number },
  rawX: number,
  rawY: number,
  zoom: number
): SnapResult {
  const threshold = ALIGN_GUIDE_PIXEL_THRESHOLD / Math.max(zoom, 0.25);

  const moving = getBounds(movingNode, rawX, rawY);

  let bestX:
    | {
        delta: number;
        guide: AlignmentGuide;
      }
    | undefined;

  let bestY:
    | {
        delta: number;
        guide: AlignmentGuide;
      }
    | undefined;

  const movingXAnchors = [
    moving.left,
    moving.centerX,
    moving.right,
  ];

  const movingYAnchors = [
    moving.top,
    moving.centerY,
    moving.bottom,
  ];

  function considerX(
    targetX: number,
    guideFrom: number,
    guideTo: number
  ) {
    for (const anchor of movingXAnchors) {
      const delta = targetX - anchor;

      if (Math.abs(delta) > threshold) continue;

      if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
        bestX = {
          delta,
          guide: {
            orientation: "vertical",
            position: targetX,
            from: guideFrom,
            to: guideTo,
          },
        };
      }
    }
  }

  function considerY(
    targetY: number,
    guideFrom: number,
    guideTo: number
  ) {
    for (const anchor of movingYAnchors) {
      const delta = targetY - anchor;

      if (Math.abs(delta) > threshold) continue;

      if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) {
        bestY = {
          delta,
          guide: {
            orientation: "horizontal",
            position: targetY,
            from: guideFrom,
            to: guideTo,
          },
        };
      }
    }
  }

  // ─────────────────────────────────────────────
  // Desktop / Artboard guides
  // ─────────────────────────────────────────────

  const artboardCenterX = artboard.x + artboard.width / 2;
  const artboardCenterY = artboard.y + artboard.height / 2;

  considerX(artboard.x, artboard.y, artboard.y + artboard.height);
  considerX(artboardCenterX, artboard.y, artboard.y + artboard.height);
  considerX(
    artboard.x + artboard.width,
    artboard.y,
    artboard.y + artboard.height
  );

  considerY(artboard.y, artboard.x, artboard.x + artboard.width);
  considerY(artboardCenterY, artboard.x, artboard.x + artboard.width);
  considerY(
    artboard.y + artboard.height,
    artboard.x,
    artboard.x + artboard.width
  );

  // ─────────────────────────────────────────────
  // Other nodes guides
  // ─────────────────────────────────────────────

  const otherNodes = scene.nodes.filter((node) => {
    if (node.id === movingNode.id) return false;
    if (node.artboardId !== movingNode.artboardId) return false;
    if ((node.parentId ?? null) !== (movingNode.parentId ?? null)) return false;
    if ((node as any).hidden) return false;

    return true;
  });

  for (const other of otherNodes) {
    const b = getBounds(other);

    const verticalFrom = Math.min(moving.top, b.top) - 4;
    const verticalTo = Math.max(moving.bottom, b.bottom) + 4;

    considerX(b.left, verticalFrom, verticalTo);
    considerX(b.centerX, verticalFrom, verticalTo);
    considerX(b.right, verticalFrom, verticalTo);

    const horizontalFrom = Math.min(moving.left, b.left) - 4;
    const horizontalTo = Math.max(moving.right, b.right) + 4;

    considerY(b.top, horizontalFrom, horizontalTo);
    considerY(b.centerY, horizontalFrom, horizontalTo);
    considerY(b.bottom, horizontalFrom, horizontalTo);
  }

  const snappedX = rawX + (bestX?.delta ?? 0);
  const snappedY = rawY + (bestY?.delta ?? 0);

  return {
    x: snappedX,
    y: snappedY,
    guides: [
      ...(bestX ? [bestX.guide] : []),
      ...(bestY ? [bestY.guide] : []),
    ],
  };
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
  const textResizeDraftRef = useRef<TextResizeDraft | null>(null);
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

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [autoLayoutPreview, setAutoLayoutPreview] =
  useState<ReturnType<typeof findAutoLayoutDropCandidate>>(null);

  const [resizePreview, setResizePreview] =
  useState<ResizePreview | null>(null);
  
  const [dragSizePreview, setDragSizePreview] =
  useState<ResizePreview | null>(null);

  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  const artboards = scene.artboards ?? [];
  const nodes = scene.nodes ?? [];
  const selection = scene.selection ?? { kind: "none" as const };

  const selectedSizePreview: ResizePreview | null =
  selection.kind === "node"
    ? (() => {
        const selectedNode = nodes.find((n) => n.id === selection.id);

        if (!selectedNode || selectedNode.hidden) {
          return null;
        }

        return {
          x: selectedNode.x,
          y: selectedNode.y,
          width: selectedNode.width,
          height: selectedNode.height,
        };
      })()
    : null;

const visibleSizePreview =
  resizePreview ?? dragSizePreview ?? selectedSizePreview;

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
function updateResizePreviewFromTransformer() {
  const stage = stageRef.current;
  const transformer = trRef.current;

  if (!stage || !transformer) return;
  if (selection.kind !== "node") return;

  const selectedNode = nodes.find((n) => n.id === selection.id);
  const target = nodeRefs.current[selection.id] as Konva.Group | null;

  if (!selectedNode || !target) return;

  const scaleX = target.scaleX();
  const scaleY = target.scaleY();

  const isTextNode = selectedNode.type === "text";

  const previewWidth = clamp(selectedNode.width * scaleX, 10, 5000);
  const previewHeight = isTextNode
    ? clamp(selectedNode.height * scaleY, 24, 5000)
    : clamp(selectedNode.height * scaleY, 10, 5000);

  // Позиція відносно Stage без впливу zoom
  const absolutePosition = target.getAbsolutePosition(stage);

  setResizePreview({
    x: absolutePosition.x,
    y: absolutePosition.y,
    width: previewWidth,
    height: previewHeight,
  });
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
  visited = new Set<string>(),
  parentWorldX = ab.x,
  parentWorldY = ab.y
): React.ReactNode {
    if (node.hidden) {
    return null;
  }
  if (visited.has(node.id)) {
    return null;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(node.id);

  const localX = node.x - parentWorldX;
const localY = node.y - parentWorldY;
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
            fill={node.backgroundColor || "rgba(255,255,255,0)"}
            cornerRadius={8}
            {...dropShadowProps}
            {...commonEvents}
          />

          <Text
            name="text-content"
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
      draggable={tool === "select" && !isSpaceDown.current}
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

      onMouseEnter={() => {
  setHoveredNodeId(node.id);
}}
onMouseLeave={() => {
  setHoveredNodeId((current) =>
    current === node.id ? null : current
  );
}}
     
onDragMove={(e: any) => {
  if (e.target !== e.currentTarget) {
    stopBubble(e);
    return;
  }

  stopBubble(e);

  const t = e.currentTarget as Konva.Group;
  const worldX = parentWorldX + t.x();
  const worldY = parentWorldY + t.y();

  const parentAutoLayoutFrame = node.parentId
    ? nodes.find(
        (n): n is FrameNode =>
          n.type === "frame" &&
          n.id === node.parentId &&
          n.autoLayout?.enabled === true
      )
    : undefined;

  // Якщо блок є елементом Auto Layout
  if (parentAutoLayoutFrame) {
    const centerX = worldX + node.width / 2;
    const centerY = worldY + node.height / 2;

    const isOutsideParent =
      centerX < parentAutoLayoutFrame.x ||
      centerX > parentAutoLayoutFrame.x + parentAutoLayoutFrame.width ||
      centerY < parentAutoLayoutFrame.y ||
      centerY > parentAutoLayoutFrame.y + parentAutoLayoutFrame.height;

    // Поки блок усередині layout — не дозволяємо йому рухатися
    if (!isOutsideParent) {
      t.position({
        x: localX,
        y: localY,
      });

      setAlignmentGuides([]);
      setAutoLayoutPreview(null);
      return;
    }

    // Якщо вже витягнули за межі — дозволяємо тягнути назовні
    setAlignmentGuides([]);
    setAutoLayoutPreview(null);
    return;
  }

  // Звичайна логіка для об'єктів поза Auto Layout
  // Звичайна логіка для об'єктів поза Auto Layout
const snap = getAlignmentSnap(
  scene,
  node,
  ab,
  worldX,
  worldY,
  zoom
);
setDragSizePreview({
  x: snap.x,
  y: snap.y,
  width: node.width,
  height: node.height,
});

t.position({
  x: snap.x - parentWorldX,
  y: snap.y - parentWorldY,
});

t.getLayer()?.batchDraw();

setAlignmentGuides(snap.guides);

setAutoLayoutPreview(
  findAutoLayoutDropCandidate(scene, node.id, snap.x, snap.y)
);
}}
onDragStart={(e: any) => {
  if (e.target !== e.currentTarget) {
    stopBubble(e);
    return;
  }

  stopBubble(e);
  setContextMenu(null);
  setAutoLayoutPreview(null);
  setDragSizePreview({
  x: node.x,
  y: node.y,
  width: node.width,
  height: node.height,
});
  setAlignmentGuides([]);
}}

onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
  if (e.target !== e.currentTarget) {
    stopBubble(e);
    setAlignmentGuides([]);
    setDragSizePreview(null);
    return;
  }

  stopBubble(e);

  const t = e.currentTarget as Konva.Group;
  const worldX = parentWorldX + t.x();
  const worldY = parentWorldY + t.y();

  const parentAutoLayoutFrame = node.parentId
    ? nodes.find(
        (n): n is FrameNode =>
          n.type === "frame" &&
          n.id === node.parentId &&
          n.autoLayout?.enabled === true
      )
    : undefined;

  // ─────────────────────────────────────────────
  // Блок був усередині Auto Layout
  // ─────────────────────────────────────────────
  if (parentAutoLayoutFrame) {
    const centerX = worldX + node.width / 2;
    const centerY = worldY + node.height / 2;

    const isOutsideParent =
      centerX < parentAutoLayoutFrame.x ||
      centerX > parentAutoLayoutFrame.x + parentAutoLayoutFrame.width ||
      centerY < parentAutoLayoutFrame.y ||
      centerY > parentAutoLayoutFrame.y + parentAutoLayoutFrame.height;

    // Якщо витягнули за межі Auto Layout — від’єднуємо блок
    if (isOutsideParent) {
      onChange({
        ...scene,
        nodes: nodes.map((n) =>
          n.id === node.id
            ? ({
                ...n,
                x: worldX,
                y: worldY,
                parentId: parentAutoLayoutFrame.parentId ?? null,
              } as SceneNode)
            : n
        ),
        selection: { kind: "node", id: node.id },
      });

      setDragSizePreview({
  x: worldX,
  y: worldY,
  width: node.width,
  height: node.height,
});

      setAutoLayoutPreview(null);
      return;
    }

    // Якщо відпустили всередині layout —
    // просто повертаємо блок назад на його штатну позицію
    t.position({
      x: localX,
      y: localY,
    });

    t.getLayer()?.batchDraw();

    setAutoLayoutPreview(null);
    return;
  }

  // ─────────────────────────────────────────────
  // Звичайний блок поза Auto Layout
  // ─────────────────────────────────────────────
  const movedScene: Scene = {
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
  };

  const candidate =
    findAutoLayoutDropCandidate(movedScene, node.id, worldX, worldY) ??
    autoLayoutPreview;

  if (candidate?.kind === "merge") {
    onChange(
      createAutoLayoutFrameFromDrop(
        movedScene,
        candidate.draggedId,
        candidate.targetId,
        candidate.direction,
        candidate.side
      )
    );
  } else if (candidate?.kind === "insert") {
    onChange(
      insertNodeIntoAutoLayoutFrame(
        movedScene,
        candidate.draggedId,
        candidate.frameId,
        candidate.insertIndex
      )
    );
  } else {
    onChange(movedScene);
  }

  setAutoLayoutPreview(null);
}}

     onTransformStart={(e: any) => {
  stopBubble(e);

  const target = e.target as Konva.Group;

  if (node.type === "text") {
    textResizeDraftRef.current = {
      nodeId: node.id,
      x: parentWorldX + target.x(),
      y: parentWorldY + target.y(),
      width: node.width,
      height: node.height,
      rotation: target.rotation(),
    };
  }

  setResizePreview({
    x: parentWorldX + target.x(),
    y: parentWorldY + target.y(),
    width: node.width,
    height: node.height,
  });
}}
onTransform={(e: Konva.KonvaEventObject<Event>) => {
  const target = e.target as Konva.Group;
  const scaleX = target.scaleX();
  const scaleY = target.scaleY();

  const isTextNode = node.type === "text";
  const previewW = clamp(node.width * scaleX, 10, 5000);
  const previewH = isTextNode
    ? clamp(node.height * scaleY, 24, 5000)
    : clamp(node.height * scaleY, 10, 5000);

  if (isTextNode) {
    const textShape = target.findOne(".text-content") as Konva.Text | undefined;

    if (textShape) {
      textShape.scaleX(scaleX === 0 ? 1 : 1 / scaleX);
      textShape.scaleY(scaleY === 0 ? 1 : 1 / scaleY);
      textShape.width(previewW);
      textShape.height(previewH);
    }

    textResizeDraftRef.current = {
      nodeId: node.id,
      x: parentWorldX + target.x(),
      y: parentWorldY + target.y(),
      width: previewW,
      height: previewH,
      rotation: target.rotation(),
    };

    target.getLayer()?.batchDraw();
  }

  setResizePreview({
    x: parentWorldX + target.x(),
    y: parentWorldY + target.y(),
    width: previewW,
    height: previewH,
  });
}}
onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
  const target = e.target as Konva.Group;
  const scaleX = target.scaleX();
  const scaleY = target.scaleY();
  const isTextNode = node.type === "text";

  const draft =
    isTextNode && textResizeDraftRef.current?.nodeId === node.id
      ? textResizeDraftRef.current
      : null;

  const newW = draft?.width ?? clamp(node.width * scaleX, 10, 5000);
  const newH =
    draft?.height ??
    (isTextNode
      ? clamp(node.height * scaleY, 24, 5000)
      : clamp(node.height * scaleY, 10, 5000));

  target.scaleX(1);
  target.scaleY(1);

  if (isTextNode) {
    const textShape = target.findOne(".text-content") as Konva.Text | undefined;

    if (textShape) {
      textShape.scaleX(1);
      textShape.scaleY(1);
      textShape.width(newW);
      textShape.height(newH);
    }

    textResizeDraftRef.current = null;
  }

  onChange({
    ...scene,
    nodes: nodes.map((n) =>
      n.id === node.id
        ? ({
            ...n,
            x: draft?.x ?? parentWorldX + target.x(),
            y: draft?.y ?? parentWorldY + target.y(),
            width: newW,
            height: newH,
            rotation: draft?.rotation ?? target.rotation(),
          } as SceneNode)
        : n
    ),
  });

  setResizePreview(null);
}}
      ref={(ref: any) => {
        nodeRefs.current[node.id] = ref;
      }}
        >
      {content}

            {hoveredNodeId === node.id && !isNodeSelected && (
        <Rect
          x={0}
          y={0}
          width={Math.max(node.width, 8)}
          height={Math.max(node.height, 8)}
          stroke={ACCENT}
          strokeWidth={1}
          listening={false}
        />
      )}

      {node.type === "frame" && children.length > 0 && (
        node.clipContent === false ? (
          <>
            {children.map((child) =>
              renderNode(child, ab, nextVisited, node.x, node.y)
            )}
          </>
        ) : (
          <Group
            clipX={0}
            clipY={0}
            clipWidth={node.width}
            clipHeight={node.height}
          >
            {children.map((child) =>
              renderNode(child, ab, nextVisited, node.x, node.y)
            )}
          </Group>
        )
      )}
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
        style={{ outline: "none", background: "transparent", touchAction: "none" as any }}
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
              !(!isSpaceDown.current) &&
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

          {autoLayoutPreview && (
  <>
    <Rect
      x={autoLayoutPreview.previewRect.x}
      y={autoLayoutPreview.previewRect.y}
      width={autoLayoutPreview.previewRect.width}
      height={autoLayoutPreview.previewRect.height}
      stroke={ACCENT}
      strokeWidth={2}
      dash={[8, 5]}
      cornerRadius={12}
      listening={false}
    />

    <Line
      points={[
        autoLayoutPreview.insertLine.x1,
        autoLayoutPreview.insertLine.y1,
        autoLayoutPreview.insertLine.x2,
        autoLayoutPreview.insertLine.y2,
      ]}
      stroke={ACCENT}
      strokeWidth={3}
      lineCap="round"
      listening={false}
    />
  </>
)}
{alignmentGuides.map((guide, index) =>
  guide.orientation === "vertical" ? (
    <Line
      key={`guide-v-${index}`}
      points={[
        guide.position,
        guide.from,
        guide.position,
        guide.to,
      ]}
      stroke={ALIGN_GUIDE_COLOR}
      strokeWidth={1}
      listening={false}
    />
  ) : (
    <Line
      key={`guide-h-${index}`}
      points={[
        guide.from,
        guide.position,
        guide.to,
        guide.position,
      ]}
      stroke={ALIGN_GUIDE_COLOR}
      strokeWidth={1}
      listening={false}
    />
  )
)}

{visibleSizePreview && (() => {
  const label = `${Math.round(visibleSizePreview.width)} × ${Math.round(
    visibleSizePreview.height
  )}`;

  const boxWidth = Math.max(72, label.length * 7 + 16);
  const boxHeight = 24;

  const boxX =
    visibleSizePreview.x +
    visibleSizePreview.width / 2 -
    boxWidth / 2;

  const boxY =
    visibleSizePreview.y +
    visibleSizePreview.height +
    10;

  return (
    <Group listening={false}>
      <Rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
       fill="#2b61ff"
        cornerRadius={2}
      />

      <Text
        x={boxX}
        y={boxY + 5}
        width={boxWidth}
        text={label}
        align="center"
        fill="#ffffff"
        fontSize={13}
        fontStyle="bold"
      />
    </Group>
  );
})()}

          <Transformer
  ref={(r) => (trRef.current = r)}
    onTransformStart={() => {
    updateResizePreviewFromTransformer();
  }}
  onTransform={() => {
    updateResizePreviewFromTransformer();
  }}
  onTransformEnd={() => {
    setResizePreview(null);
  }}
  rotateEnabled={selection.kind === "node"}
  enabledAnchors={[
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]}
  borderStroke={ACCENT}
  borderStrokeWidth={1}
  borderDash={[]}
  padding={2}
  anchorSize={7}
  anchorCornerRadius={2}
  anchorStroke={ACCENT}
  anchorStrokeWidth={1}
  anchorFill="#ffffff"
  rotateAnchorOffset={22}
  anchorStyleFunc={(anchor) => {
    const isTopCenter = anchor.hasName("top-center");
    const isBottomCenter = anchor.hasName("bottom-center");
    const isMiddleLeft = anchor.hasName("middle-left");
    const isMiddleRight = anchor.hasName("middle-right");

    // Верхня та нижня ручки — горизонтальні "полосочки"
    if (isTopCenter || isBottomCenter) {
      anchor.width(18);
      anchor.height(6);
      anchor.offsetX(9);
      anchor.offsetY(3);
      anchor.cornerRadius(3);
      anchor.fill("#ffffff");
      anchor.stroke(ACCENT);
      anchor.strokeWidth(1);
      return;
    }

    // Ліва та права ручки — вертикальні "полосочки"
    if (isMiddleLeft || isMiddleRight) {
      anchor.width(6);
      anchor.height(18);
      anchor.offsetX(3);
      anchor.offsetY(9);
      anchor.cornerRadius(3);
      anchor.fill("#ffffff");
      anchor.stroke(ACCENT);
      anchor.strokeWidth(1);
      return;
    }

    // Кутові ручки — маленькі квадрати
    anchor.width(8);
    anchor.height(8);
    anchor.offsetX(4);
    anchor.offsetY(4);
    anchor.cornerRadius(1);
    anchor.fill("#ffffff");
    anchor.stroke(ACCENT);
    anchor.strokeWidth(1.5);
  }}
  boundBoxFunc={(oldBox, newBox) => {
    if (newBox.width < 10 || newBox.height < 10) {
      return oldBox;
    }

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