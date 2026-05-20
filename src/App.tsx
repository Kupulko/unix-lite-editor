import React, { useEffect, useRef, useState } from "react";
import type {
  Artboard,
  ArrowNode,
  EllipseNode,
  FrameNode,
  ImageNode,
  LineNode,
  PolygonNode,
  RectNode,
  Scene,
  SceneNode,
  StarNode,
  TextNode,
} from "./types";
import { v4 as uuid } from "uuid";
import LayersPanel from "./editor/LayersPanel";
import Editor from "./editor/Editor";
import PropsPanel from "./editor/PropsPanel";
import { makeDefaultScene } from "./editor/defaultScene";
import { exportSceneAsViteReactZip } from "./export/exportProject";
import TopBar from "./ui/TopBar";
import BottomToolbar, { Tool } from "./ui/BottomToolbar";
import {
  applyAutoLayoutToScene,
  assignNodeToFrame,
  clamp,
  reorderNodeRelative,
  safeNumber,
} from "./utils";
import LeftSidebar, { LeftPanelView } from "./ui/LeftSidebar";
import AddElementsPanel from "./ui/AddElementsPanel";
import LandingPage from "./ui/LandingPage";
import AuthPage from "./ui/AuthPage";
import ProjectsPage from "./ui/ProjectsPage";
import type { AppSession, ProjectRecord } from "./ui/productTypes";

function normalizeScene(raw: Scene): Scene {
  return {
    ...raw,
    artboards: Array.isArray(raw.artboards) ? raw.artboards : [],
    nodes: Array.isArray(raw.nodes)
      ? raw.nodes.map((node) => {
          const normalizedEffects = Array.isArray((node as any).effects)
            ? (node as any).effects
                .map((effect: any) => {
                  if (!effect || typeof effect !== "object") return null;

                  if (effect.type === "drop-shadow") {
                    return {
                      id: effect.id ?? uuid(),
                      type: "drop-shadow",
                      enabled: effect.enabled ?? true,
                      x: typeof effect.x === "number" ? effect.x : 0,
                      y: typeof effect.y === "number" ? effect.y : 4,
                      blur: typeof effect.blur === "number" ? effect.blur : 4,
                      spread: typeof effect.spread === "number" ? effect.spread : 0,
                      color: typeof effect.color === "string" ? effect.color : "#000000",
                      alpha: typeof effect.alpha === "number" ? effect.alpha : 0.25,
                    };
                  }

                  if (effect.type === "inner-shadow") {
                    return {
                      id: effect.id ?? uuid(),
                      type: "inner-shadow",
                      enabled: effect.enabled ?? true,
                      x: typeof effect.x === "number" ? effect.x : 0,
                      y: typeof effect.y === "number" ? effect.y : 4,
                      blur: typeof effect.blur === "number" ? effect.blur : 4,
                      spread: typeof effect.spread === "number" ? effect.spread : 0,
                      color: typeof effect.color === "string" ? effect.color : "#000000",
                      alpha: typeof effect.alpha === "number" ? effect.alpha : 0.25,
                    };
                  }

                  if (effect.type === "layer-blur") {
                    return {
                      id: effect.id ?? uuid(),
                      type: "layer-blur",
                      enabled: effect.enabled ?? true,
                      mode: effect.mode === "progressive" ? "progressive" : "uniform",
                      blur: typeof effect.blur === "number" ? effect.blur : 4,
                    };
                  }

                  if (effect.type === "background-blur") {
                    return {
                      id: effect.id ?? uuid(),
                      type: "background-blur",
                      enabled: effect.enabled ?? true,
                      mode: effect.mode === "progressive" ? "progressive" : "uniform",
                      blur: typeof effect.blur === "number" ? effect.blur : 4,
                    };
                  }

                  return null;
                })
                .filter(Boolean)
            : [];

          const parentId =
            typeof (node as any).parentId === "string" ? (node as any).parentId : null;

          if (node.type === "ellipse") {
            const legacyArc =
              typeof (node as any).arc === "number"
                ? clamp((node as any).arc, 1, 360)
                : 360;

            const derivedArcPercent = Math.round((legacyArc / 360) * 100);

            return {
              ...node,
              parentId,
              effects: normalizedEffects,
              arcPercent:
                typeof (node as any).arcPercent === "number"
                  ? clamp((node as any).arcPercent, 1, 100)
                  : clamp(derivedArcPercent, 1, 100),
              arcRotation:
                typeof (node as any).arcRotation === "number"
                  ? (node as any).arcRotation
                  : 0,
              holePercent:
                typeof (node as any).holePercent === "number"
                  ? clamp((node as any).holePercent, 0, 95)
                  : 0,
              centerOffsetPercent:
                typeof (node as any).centerOffsetPercent === "number"
                  ? clamp((node as any).centerOffsetPercent, 0, 80)
                  : 0,
            } as SceneNode;
          }

          if (node.type === "polygon") {
            return {
              ...node,
              parentId,
              effects: normalizedEffects,
              sides: typeof node.sides === "number" ? clamp(node.sides, 3, 24) : 3,
            } as SceneNode;
          }

          if (node.type === "star") {
            const legacyInnerScale =
              typeof (node as any).innerScale === "number"
                ? clamp((node as any).innerScale, 0.1, 0.95)
                : 0.45;

            return {
              ...node,
              parentId,
              effects: normalizedEffects,
              points: typeof node.points === "number" ? clamp(node.points, 3, 40) : 5,
              innerRatioPercent:
                typeof (node as any).innerRatioPercent === "number"
                  ? clamp((node as any).innerRatioPercent, 10, 95)
                  : Math.round(legacyInnerScale * 100),
            } as SceneNode;
          }

          if (node.type === "frame") {
            return {
              ...node,
              parentId,
              effects: normalizedEffects,
              clipContent: (node as any).clipContent ?? true,
              autoLayout: (node as any).autoLayout
                ? {
                    enabled: (node as any).autoLayout.enabled ?? true,
                    direction:
                      (node as any).autoLayout.direction === "vertical"
                        ? "vertical"
                        : "horizontal",
                    gap: safeNumber((node as any).autoLayout.gap, 12),
                    paddingX: safeNumber((node as any).autoLayout.paddingX, 16),
                    paddingY: safeNumber((node as any).autoLayout.paddingY, 16),
                    align:
                      (node as any).autoLayout.align === "center" ||
                      (node as any).autoLayout.align === "end"
                        ? (node as any).autoLayout.align
                        : "start",
                    hugContent: !!(node as any).autoLayout.hugContent,
                  }
                : undefined,
            } as SceneNode;
          }

          return {
            ...node,
            parentId,
            effects: normalizedEffects,
          } as SceneNode;
        })
      : [],
    selection: raw.selection ?? { kind: "none" },
  };
}

function finalizeScene(scene: Scene) {
  return applyAutoLayoutToScene(scene);
}

function addDesktopArtboard(scene: Scene): Scene {
  const id = uuid();
  const index = (scene.artboards ?? []).length;
  const x = 120 + index * 1150;
  const y = 120;

  const art: Artboard = {
    id,
    name: `Desktop ${index + 1}`,
    x,
    y,
    width: 1440,
    height: 900,
    fill: "#ffffff",
    stroke: "#cfcfcf",
  };

  return {
    ...scene,
    artboards: [...(scene.artboards ?? []), art],
    selection: { kind: "artboard", id },
  };
}

function addRectAt(
  scene: Scene,
  artboardId: string,
  worldX: number,
  worldY: number
): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const size = 180;

  const x = clamp(worldX - size / 2, ab.x, ab.x + ab.width - size);
  const y = clamp(worldY - size / 2, ab.y, ab.y + ab.height - size);

  const id = uuid();

  const node: RectNode = {
    id,
    type: "rect",
    artboardId,
    parentId: null,
    name: `Rectangle ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: size,
    height: size,
    fill: "#2c2c2c",
    stroke: "transparent",
    strokeWidth: 0,
    cornerRadius: 0,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...(scene.nodes ?? []), node],
    selection: { kind: "node", id },
  };
}

function addFrameAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 320;
  const h = 220;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: FrameNode = {
    id,
    type: "frame",
    artboardId,
    parentId: null,
    name: `Frame ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    fill: "#25282f",
    stroke: "#4c5361",
    strokeWidth: 1,
    cornerRadius: 12,
    opacity: 1,
    rotation: 0,
    clipContent: true,
    autoLayout: {
      enabled: true,
      direction: "vertical",
      gap: 12,
      paddingX: 16,
      paddingY: 16,
      align: "start",
      hugContent: false,
    },
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addTextAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 180;
  const h = 58;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: TextNode = {
    id,
    type: "text",
    artboardId,
    parentId: null,
    name: `Text ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    text: "Text",
    color: "#111111",
    backgroundColor: "rgba(255,255,255,0)",
    fontSize: 28,
    fontFamily: "Inter, Arial, sans-serif",
    fontWeight: 400,
    fontStyle: "normal",
    align: "left",
    wrap: "word",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 12,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addLineAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 220;
  const h = 120;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: LineNode = {
    id,
    type: "line",
    artboardId,
    parentId: null,
    name: `Line ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    stroke: "#e8e8e8",
    strokeWidth: 3,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addArrowAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 240;
  const h = 120;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: ArrowNode = {
    id,
    type: "arrow",
    artboardId,
    parentId: null,
    name: `Arrow ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    stroke: "#e8e8e8",
    strokeWidth: 3,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addEllipseAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const size = 180;
  const x = clamp(worldX - size / 2, ab.x, ab.x + ab.width - size);
  const y = clamp(worldY - size / 2, ab.y, ab.y + ab.height - size);

  const id = uuid();
  const node: EllipseNode = {
    id,
    type: "ellipse",
    artboardId,
    parentId: null,
    name: `Ellipse ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: size,
    height: size,
    fill: "#2c2c2c",
    stroke: "#3a3a3a",
    strokeWidth: 1,
    arcPercent: 100,
    arcRotation: 0,
    holePercent: 0,
    centerOffsetPercent: 0,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addPolygonAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 180;
  const h = 180;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: PolygonNode = {
    id,
    type: "polygon",
    artboardId,
    parentId: null,
    name: `Polygon ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    fill: "#2c2c2c",
    stroke: "#3a3a3a",
    strokeWidth: 1,
    sides: 3,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addStarAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 180;
  const h = 180;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: StarNode = {
    id,
    type: "star",
    artboardId,
    parentId: null,
    name: `Star ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    fill: "#2c2c2c",
    stroke: "#3a3a3a",
    strokeWidth: 1,
    points: 5,
    innerRatioPercent: 45,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}

function addImageAt(scene: Scene, artboardId: string, worldX: number, worldY: number): Scene {
  const ab = scene.artboards.find((a) => a.id === artboardId);
  if (!ab) return scene;

  const w = 260;
  const h = 180;
  const x = clamp(worldX - w / 2, ab.x, ab.x + ab.width - w);
  const y = clamp(worldY - h / 2, ab.y, ab.y + ab.height - h);

  const id = uuid();
  const node: ImageNode = {
    id,
    type: "image",
    artboardId,
    parentId: null,
    name: `Image ${(scene.nodes ?? []).length + 1}`,
    x,
    y,
    width: w,
    height: h,
    src: "",
    fit: "cover",
    stroke: "#3a3a3a",
    strokeWidth: 1,
    opacity: 1,
    rotation: 0,
  };

  return {
    ...scene,
    nodes: [...scene.nodes, node],
    selection: { kind: "node", id },
  };
}


type SemanticRole =
  | "header"
  | "navigation"
  | "nav-link"
  | "button"
  | "hero"
  | "card"
  | "input-field"
  | "footer"
  | "sidebar"
  | "section";

type SemanticTag =
  | "header"
  | "nav"
  | "a"
  | "button"
  | "section"
  | "article"
  | "input"
  | "footer"
  | "aside"
  | "div"
  | "h1"
  | "h2"
  | "p"
  | "span";

function exportMeta(
  role: SemanticRole,
  tag: SemanticTag,
  component?: string,
  exportAsComponent = false
) {
  return {
    role,
    tag,
    component,
    exportAsComponent,
  };
}

function getActiveArtboard(scene: Scene): Artboard | null {
  if (scene.selection.kind === "artboard") {
    const selectedArtboardId = scene.selection.id;
    return scene.artboards.find((artboard) => artboard.id === selectedArtboardId) ?? null;
  }

  if (scene.selection.kind === "node") {
    const selectedNodeId = scene.selection.id;
    const selectedNode = scene.nodes.find((node) => node.id === selectedNodeId);
    if (selectedNode) {
      return scene.artboards.find((artboard) => artboard.id === selectedNode.artboardId) ?? null;
    }
  }

  return scene.artboards[0] ?? null;
}

function getPresetOffset(scene: Scene, role: SemanticRole) {
  const count = scene.nodes.filter((node) => node.exportMeta?.role === role).length;
  return (count % 8) * 18;
}

function placePreset(
  artboard: Artboard,
  width: number,
  height: number,
  offset = 0,
  preferTop = false
) {
  const x = clamp(
    artboard.x + (artboard.width - width) / 2 + offset,
    artboard.x + 24,
    artboard.x + artboard.width - width - 24
  );

  const rawY = preferTop
    ? artboard.y + 42 + offset
    : artboard.y + (artboard.height - height) / 2 + offset;

  const y = clamp(rawY, artboard.y + 24, artboard.y + artboard.height - height - 24);
  return { x, y };
}

function makeFrameNode({
  id,
  artboardId,
  parentId = null,
  name,
  x,
  y,
  width,
  height,
  fill,
  stroke = "rgba(255,255,255,0)",
  strokeWidth = 0,
  cornerRadius = 0,
  autoLayout,
  meta,
}: {
  id: string;
  artboardId: string;
  parentId?: string | null;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  autoLayout?: FrameNode["autoLayout"];
  meta?: FrameNode["exportMeta"];
}): FrameNode {
  return {
    id,
    type: "frame",
    artboardId,
    parentId,
    name,
    x,
    y,
    width,
    height,
    fill,
    stroke,
    strokeWidth,
    cornerRadius,
    opacity: 1,
    rotation: 0,
    clipContent: true,
    autoLayout,
    exportMeta: meta,
  };
}

function makeTextNode({
  id,
  artboardId,
  parentId = null,
  name,
  x,
  y,
  width,
  height,
  text,
  color = "#111111",
  fontSize = 16,
  fontWeight = 500,
  align = "left",
  padding = 0,
  meta,
}: {
  id: string;
  artboardId: string;
  parentId?: string | null;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: TextNode["align"];
  padding?: number;
  meta?: TextNode["exportMeta"];
}): TextNode {
  return {
    id,
    type: "text",
    artboardId,
    parentId,
    name,
    x,
    y,
    width,
    height,
    text,
    color,
    backgroundColor: "rgba(255,255,255,0)",
    fontSize,
    fontFamily: "Inter, Arial, sans-serif",
    fontWeight,
    fontStyle: "normal",
    align,
    wrap: "word",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding,
    opacity: 1,
    rotation: 0,
    exportMeta: meta,
  };
}

function addNodes(scene: Scene, nodes: SceneNode[], selectedId: string): Scene {
  return {
    ...scene,
    nodes: [...scene.nodes, ...nodes],
    selection: { kind: "node", id: selectedId },
  };
}

function createButtonNodes({
  artboardId,
  parentId = null,
  x,
  y,
  width = 152,
  height = 48,
  label = "Button",
  name = "Button",
  kind = "primary",
}: {
  artboardId: string;
  parentId?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  name?: string;
  kind?: "primary" | "ghost" | "nav";
}) {
  const buttonId = uuid();
  const labelId = uuid();

  const buttonFill =
    kind === "primary"
      ? "#2b61ff"
      : kind === "nav"
      ? "rgba(255,255,255,0.04)"
      : "rgba(255,255,255,0.02)";

  const buttonStroke =
    kind === "primary"
      ? "rgba(255,255,255,0)"
      : "rgba(255,255,255,0.12)";

  const textColor = kind === "primary" ? "#ffffff" : "#e9eefc";

  const button = makeFrameNode({
    id: buttonId,
    artboardId,
    parentId,
    name,
    x,
    y,
    width,
    height,
    fill: buttonFill,
    stroke: buttonStroke,
    strokeWidth: kind === "primary" ? 0 : 1,
    cornerRadius: 14,
    autoLayout: {
      enabled: true,
      direction: "horizontal",
      gap: 0,
      paddingX: 16,
      paddingY: 11,
      align: "center",
      hugContent: false,
    },
    meta: exportMeta(kind === "nav" ? "nav-link" : "button", kind === "nav" ? "a" : "button", "Button", true),
  });

  const text = makeTextNode({
    id: labelId,
    artboardId,
    parentId: buttonId,
    name: `${name} label`,
    x: x + 16,
    y: y + 11,
    width: Math.max(72, width - 32),
    height: 26,
    text: label,
    color: textColor,
    fontSize: 15,
    fontWeight: 600,
    align: "center",
    meta: exportMeta(kind === "nav" ? "nav-link" : "button", "span"),
  });

  return { button, text };
}

function addStandaloneButtonPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const offset = getPresetOffset(scene, "button");
  const pos = placePreset(artboard, 152, 48, offset);
  const { button, text } = createButtonNodes({
    artboardId: artboard.id,
    x: pos.x,
    y: pos.y,
    label: "Button",
    name: `Button ${scene.nodes.filter((node) => node.exportMeta?.role === "button").length + 1}`,
  });

  return addNodes(scene, [button, text], button.id);
}

function addHeaderNavigationPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const offset = getPresetOffset(scene, "header");
  const width = Math.min(artboard.width - 96, 1180);
  const height = 96;
  const pos = placePreset(artboard, width, height, offset, true);

  const headerId = uuid();
  const logoId = uuid();
  const navId = uuid();

  const header = makeFrameNode({
    id: headerId,
    artboardId: artboard.id,
    name: `Header ${scene.nodes.filter((node) => node.exportMeta?.role === "header").length + 1}`,
    x: pos.x,
    y: pos.y,
    width,
    height,
    fill: "rgba(20, 23, 31, 0.92)",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: 1,
    cornerRadius: 20,
    autoLayout: {
      enabled: true,
      direction: "horizontal",
      gap: 22,
      paddingX: 24,
      paddingY: 18,
      align: "center",
      hugContent: false,
    },
    meta: exportMeta("header", "header", "Header", true),
  });

  const logo = makeTextNode({
    id: logoId,
    artboardId: artboard.id,
    parentId: headerId,
    name: "Brand / Logo",
    x: pos.x + 24,
    y: pos.y + 27,
    width: 174,
    height: 42,
    text: "ORIX",
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 750,
    meta: exportMeta("header", "span"),
  });

  const nav = makeFrameNode({
    id: navId,
    artboardId: artboard.id,
    parentId: headerId,
    name: "Navigation",
    x: pos.x + 220,
    y: pos.y + 22,
    width: 520,
    height: 52,
    fill: "rgba(255,255,255,0)",
    cornerRadius: 0,
    autoLayout: {
      enabled: true,
      direction: "horizontal",
      gap: 10,
      paddingX: 0,
      paddingY: 2,
      align: "center",
      hugContent: true,
    },
    meta: exportMeta("navigation", "nav", "Navigation", true),
  });

  const first = createButtonNodes({
    artboardId: artboard.id,
    parentId: navId,
    x: pos.x + 220,
    y: pos.y + 24,
    width: 118,
    height: 48,
    label: "Home",
    name: "Nav link: Home",
    kind: "nav",
  });
  const second = createButtonNodes({
    artboardId: artboard.id,
    parentId: navId,
    x: pos.x + 348,
    y: pos.y + 24,
    width: 132,
    height: 48,
    label: "Features",
    name: "Nav link: Features",
    kind: "nav",
  });
  const third = createButtonNodes({
    artboardId: artboard.id,
    parentId: navId,
    x: pos.x + 490,
    y: pos.y + 24,
    width: 124,
    height: 48,
    label: "Contact",
    name: "Nav link: Contact",
    kind: "nav",
  });
  const cta = createButtonNodes({
    artboardId: artboard.id,
    parentId: headerId,
    x: pos.x + width - 190,
    y: pos.y + 24,
    width: 174,
    height: 48,
    label: "Get started",
    name: "Header CTA",
    kind: "primary",
  });

  return addNodes(
    scene,
    [
      header,
      logo,
      nav,
      first.button,
      first.text,
      second.button,
      second.text,
      third.button,
      third.text,
      cta.button,
      cta.text,
    ],
    headerId
  );
}

function findAncestorByRole(scene: Scene, nodeId: string, role: SemanticRole): FrameNode | null {
  let current = scene.nodes.find((node) => node.id === nodeId) ?? null;

  while (current) {
    if (current.type === "frame" && current.exportMeta?.role === role) {
      return current;
    }

    current = current.parentId
      ? scene.nodes.find((node) => node.id === current?.parentId) ?? null
      : null;
  }

  return null;
}

function findNavigationForSelection(scene: Scene): FrameNode | null {
  if (scene.selection.kind !== "node") return null;
  const selectedId = scene.selection.id;

  const directNavigation = findAncestorByRole(scene, selectedId, "navigation");
  if (directNavigation) return directNavigation;

  const header = findAncestorByRole(scene, selectedId, "header");
  if (!header) return null;

  return (
    scene.nodes.find(
      (node): node is FrameNode =>
        node.type === "frame" &&
        node.parentId === header.id &&
        node.exportMeta?.role === "navigation"
    ) ?? null
  );
}

function addNavigationButtonToSelection(scene: Scene): Scene {
  const nav = findNavigationForSelection(scene);
  if (!nav) return scene;

  const index = scene.nodes.filter(
    (node) => node.parentId === nav.id && node.exportMeta?.role === "nav-link"
  ).length;

  const { button, text } = createButtonNodes({
    artboardId: nav.artboardId,
    parentId: nav.id,
    x: nav.x + 12 + index * 126,
    y: nav.y + 2,
    width: 128,
    height: 48,
    label: `Link ${index + 1}`,
    name: `Nav link: Link ${index + 1}`,
    kind: "nav",
  });

  return addNodes(scene, [button, text], button.id);
}

function addHeroPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const width = Math.min(artboard.width - 120, 980);
  const height = 330;
  const offset = getPresetOffset(scene, "hero");
  const pos = placePreset(artboard, width, height, offset);
  const heroId = uuid();

  const hero = makeFrameNode({
    id: heroId,
    artboardId: artboard.id,
    name: `Hero section ${scene.nodes.filter((node) => node.exportMeta?.role === "hero").length + 1}`,
    x: pos.x,
    y: pos.y,
    width,
    height,
    fill: "#121621",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: 1,
    cornerRadius: 28,
    autoLayout: {
      enabled: true,
      direction: "vertical",
      gap: 16,
      paddingX: 42,
      paddingY: 40,
      align: "start",
      hugContent: false,
    },
    meta: exportMeta("hero", "section", "HeroSection", true),
  });

  const title = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: heroId,
    name: "Hero title",
    x: pos.x + 42,
    y: pos.y + 40,
    width: Math.min(760, width - 84),
    height: 76,
    text: "Design interfaces faster",
    color: "#ffffff",
    fontSize: 42,
    fontWeight: 760,
    meta: exportMeta("hero", "h1"),
  });

  const subtitle = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: heroId,
    name: "Hero subtitle",
    x: pos.x + 42,
    y: pos.y + 132,
    width: Math.min(720, width - 84),
    height: 58,
    text: "Build reusable blocks that export to clean front-end code.",
    color: "#c8d1e8",
    fontSize: 20,
    fontWeight: 450,
    meta: exportMeta("hero", "p"),
  });

  const cta = createButtonNodes({
    artboardId: artboard.id,
    parentId: heroId,
    x: pos.x + 42,
    y: pos.y + 214,
    width: 184,
    height: 52,
    label: "Start creating",
    name: "Hero CTA",
    kind: "primary",
  });

  return addNodes(scene, [hero, title, subtitle, cta.button, cta.text], heroId);
}

function addCardPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const width = 360;
  const height = 288;
  const offset = getPresetOffset(scene, "card");
  const pos = placePreset(artboard, width, height, offset);
  const cardId = uuid();

  const card = makeFrameNode({
    id: cardId,
    artboardId: artboard.id,
    name: `Card ${scene.nodes.filter((node) => node.exportMeta?.role === "card").length + 1}`,
    x: pos.x,
    y: pos.y,
    width,
    height,
    fill: "#151a24",
    stroke: "rgba(255,255,255,0.09)",
    strokeWidth: 1,
    cornerRadius: 22,
    autoLayout: {
      enabled: true,
      direction: "vertical",
      gap: 12,
      paddingX: 24,
      paddingY: 24,
      align: "start",
      hugContent: false,
    },
    meta: exportMeta("card", "article", "Card", true),
  });

  const eyebrow = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: cardId,
    name: "Card label",
    x: pos.x + 24,
    y: pos.y + 24,
    width: width - 48,
    height: 22,
    text: "FEATURE",
    color: "#89a4ff",
    fontSize: 12,
    fontWeight: 700,
    meta: exportMeta("card", "span"),
  });

  const title = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: cardId,
    name: "Card title",
    x: pos.x + 24,
    y: pos.y + 58,
    width: width - 48,
    height: 42,
    text: "Reusable component",
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 700,
    meta: exportMeta("card", "h2"),
  });

  const body = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: cardId,
    name: "Card description",
    x: pos.x + 24,
    y: pos.y + 112,
    width: width - 48,
    height: 70,
    text: "A structured block that can later become a React component.",
    color: "#c8d1e8",
    fontSize: 16,
    fontWeight: 450,
    meta: exportMeta("card", "p"),
  });

  const button = createButtonNodes({
    artboardId: artboard.id,
    parentId: cardId,
    x: pos.x + 24,
    y: pos.y + 204,
    width: 160,
    height: 48,
    label: "Read more",
    name: "Card button",
    kind: "ghost",
  });

  return addNodes(scene, [card, eyebrow, title, body, button.button, button.text], cardId);
}

function addInputFieldPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const width = 420;
  const height = 124;
  const offset = getPresetOffset(scene, "input-field");
  const pos = placePreset(artboard, width, height, offset);
  const fieldId = uuid();
  const inputId = uuid();

  const field = makeFrameNode({
    id: fieldId,
    artboardId: artboard.id,
    name: `Input field ${scene.nodes.filter((node) => node.exportMeta?.role === "input-field").length + 1}`,
    x: pos.x,
    y: pos.y,
    width,
    height,
    fill: "rgba(255,255,255,0)",
    autoLayout: {
      enabled: true,
      direction: "vertical",
      gap: 10,
      paddingX: 0,
      paddingY: 0,
      align: "start",
      hugContent: false,
    },
    meta: exportMeta("input-field", "div", "FormField", true),
  });

  const label = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: fieldId,
    name: "Input label",
    x: pos.x,
    y: pos.y,
    width,
    height: 24,
    text: "Email",
    color: "#edf2ff",
    fontSize: 14,
    fontWeight: 600,
    meta: exportMeta("input-field", "span"),
  });

  const input = makeFrameNode({
    id: inputId,
    artboardId: artboard.id,
    parentId: fieldId,
    name: "Input",
    x: pos.x,
    y: pos.y + 34,
    width,
    height: 64,
    fill: "#11151f",
    stroke: "rgba(255,255,255,0.12)",
    strokeWidth: 1,
    cornerRadius: 16,
    autoLayout: {
      enabled: true,
      direction: "horizontal",
      gap: 0,
      paddingX: 18,
      paddingY: 20,
      align: "center",
      hugContent: false,
    },
    meta: exportMeta("input-field", "input", "Input", true),
  });

  const placeholder = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: inputId,
    name: "Input placeholder",
    x: pos.x + 18,
    y: pos.y + 54,
    width: width - 36,
    height: 24,
    text: "name@example.com",
    color: "#8f9bb5",
    fontSize: 16,
    fontWeight: 450,
    meta: exportMeta("input-field", "span"),
  });

  return addNodes(scene, [field, label, input, placeholder], fieldId);
}

function addFooterPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const width = Math.min(artboard.width - 96, 1180);
  const height = 120;
  const offset = getPresetOffset(scene, "footer");
  const pos = placePreset(artboard, width, height, offset, false);
  const footerY = clamp(
    artboard.y + artboard.height - height - 44 - offset,
    artboard.y + 24,
    artboard.y + artboard.height - height - 24
  );
  const footerId = uuid();

  const footer = makeFrameNode({
    id: footerId,
    artboardId: artboard.id,
    name: `Footer ${scene.nodes.filter((node) => node.exportMeta?.role === "footer").length + 1}`,
    x: pos.x,
    y: footerY,
    width,
    height,
    fill: "#121621",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: 1,
    cornerRadius: 20,
    autoLayout: {
      enabled: true,
      direction: "horizontal",
      gap: 30,
      paddingX: 28,
      paddingY: 36,
      align: "center",
      hugContent: false,
    },
    meta: exportMeta("footer", "footer", "Footer", true),
  });

  const brand = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: footerId,
    name: "Footer brand",
    x: pos.x + 28,
    y: footerY + 42,
    width: 180,
    height: 36,
    text: "ORIX",
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 750,
    meta: exportMeta("footer", "span"),
  });

  const copy = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: footerId,
    name: "Footer copyright",
    x: pos.x + 250,
    y: footerY + 46,
    width: 420,
    height: 28,
    text: "© 2026 Your product. All rights reserved.",
    color: "#b5c0db",
    fontSize: 15,
    fontWeight: 450,
    meta: exportMeta("footer", "p"),
  });

  return addNodes(scene, [footer, brand, copy], footerId);
}

function addSidebarPreset(scene: Scene): Scene {
  const artboard = getActiveArtboard(scene);
  if (!artboard) return scene;

  const width = 280;
  const height = Math.min(artboard.height - 100, 560);
  const offset = getPresetOffset(scene, "sidebar");
  const x = artboard.x + 42 + offset;
  const y = artboard.y + 72 + offset;
  const sidebarId = uuid();

  const sidebar = makeFrameNode({
    id: sidebarId,
    artboardId: artboard.id,
    name: `Sidebar ${scene.nodes.filter((node) => node.exportMeta?.role === "sidebar").length + 1}`,
    x,
    y,
    width,
    height,
    fill: "#121621",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: 1,
    cornerRadius: 24,
    autoLayout: {
      enabled: true,
      direction: "vertical",
      gap: 12,
      paddingX: 20,
      paddingY: 24,
      align: "start",
      hugContent: false,
    },
    meta: exportMeta("sidebar", "aside", "Sidebar", true),
  });

  const heading = makeTextNode({
    id: uuid(),
    artboardId: artboard.id,
    parentId: sidebarId,
    name: "Sidebar title",
    x: x + 20,
    y: y + 24,
    width: width - 40,
    height: 38,
    text: "Dashboard",
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 720,
    meta: exportMeta("sidebar", "h2"),
  });

  const first = createButtonNodes({
    artboardId: artboard.id,
    parentId: sidebarId,
    x: x + 20,
    y: y + 82,
    width: width - 40,
    height: 48,
    label: "Overview",
    name: "Sidebar link: Overview",
    kind: "nav",
  });
  const second = createButtonNodes({
    artboardId: artboard.id,
    parentId: sidebarId,
    x: x + 20,
    y: y + 142,
    width: width - 40,
    height: 48,
    label: "Projects",
    name: "Sidebar link: Projects",
    kind: "nav",
  });
  const third = createButtonNodes({
    artboardId: artboard.id,
    parentId: sidebarId,
    x: x + 20,
    y: y + 202,
    width: width - 40,
    height: 48,
    label: "Settings",
    name: "Sidebar link: Settings",
    kind: "nav",
  });

  return addNodes(
    scene,
    [sidebar, heading, first.button, first.text, second.button, second.text, third.button, third.text],
    sidebarId
  );
}

function EditorWorkspace({
  projectId,
  projectName,
  onBackToProjects,
  onProjectTouched,
}: {
  projectId: string;
  projectName: string;
  onBackToProjects: () => void;
  onProjectTouched: () => void;
}) {
  const [scene, setScene] = useState<Scene>(() => {
    const raw =
      localStorage.getItem(`orixScene:${projectId}`) ??
      (projectId === "legacy-project" ? localStorage.getItem("figmaLiteScene") : null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed?.artboards || !parsed?.selection) return finalizeScene(makeDefaultScene());
        return finalizeScene(normalizeScene(parsed as Scene));
      } catch {
        return finalizeScene(makeDefaultScene());
      }
    }
    return finalizeScene(makeDefaultScene());
  });

  const [mode, setMode] = useState<"Design" | "Prototype">("Design");
  const [tool, setTool] = useState<Tool>("select");
  const [zoomPct, setZoomPct] = useState(100);
const [leftPanelView, setLeftPanelView] =
  useState<LeftPanelView | null>(null);

  const [rightW, setRightW] = useState(
    () => Number(localStorage.getItem("rightPanelW") ?? "320") || 320
  );

  const drag = useRef<null | {
    which: "right";
    startX: number;
    startRight: number;
  }>(null);

  function commitScene(next: Scene | ((prev: Scene) => Scene)) {
  setScene((prev) => {
    const resolved =
      typeof next === "function"
        ? next(prev)
        : next;

    return finalizeScene(resolved);
  });
}

  useEffect(() => {
    localStorage.setItem(`orixScene:${projectId}`, JSON.stringify(scene));
    onProjectTouched();
  }, [scene, projectId]);

  useEffect(() => {
    localStorage.setItem("rightPanelW", String(rightW));
  }, [rightW]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();

      if (key === "v") setTool("select");
      if (key === "r") setTool("rect");
      if (key === "t") setTool("text");
      if (key === "l" && e.shiftKey) setTool("arrow");
      else if (key === "l") setTool("line");
      if (key === "o") setTool("ellipse");

      if (key === "a") {
        commitScene((s) => addDesktopArtboard(s));
        setTool("select");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current) return;

      const d = drag.current;
      const dx = e.clientX - d.startX;

      setRightW(clamp(d.startRight - dx, 240, 560));
    }

    function onUp() {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResizeRight(e: React.MouseEvent) {
    e.preventDefault();
    drag.current = {
      which: "right",
      startX: e.clientX,
      startRight: rightW,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const draggingRight = drag.current?.which === "right";

  return (
    <div className="appShell">
      
      <TopBar
        mode={mode}
        onMode={setMode}
        zoomPct={zoomPct}
        onZoomPct={setZoomPct}
        onExport={() => exportSceneAsViteReactZip(scene)}
      />

      <div
        className="workspaceRow"
        style={
          {
            ["--rightW" as any]: `${rightW}px`,
          } as React.CSSProperties
        }
      >
        <LeftSidebar
  activeView={leftPanelView}
  onActiveViewChange={setLeftPanelView}
  addContent={
    <AddElementsPanel
      canAddNavigationButton={!!findNavigationForSelection(scene)}
      onAddDesktop={() => commitScene((s) => addDesktopArtboard(s))}
      onAddFrame={() =>
        commitScene((s) => {
          const artboard = getActiveArtboard(s);
          if (!artboard) return s;
          return addFrameAt(s, artboard.id, artboard.x + artboard.width / 2, artboard.y + artboard.height / 2);
        })
      }
      onAddText={() =>
        commitScene((s) => {
          const artboard = getActiveArtboard(s);
          if (!artboard) return s;
          return addTextAt(s, artboard.id, artboard.x + artboard.width / 2, artboard.y + artboard.height / 2);
        })
      }
      onAddImage={() =>
        commitScene((s) => {
          const artboard = getActiveArtboard(s);
          if (!artboard) return s;
          return addImageAt(s, artboard.id, artboard.x + artboard.width / 2, artboard.y + artboard.height / 2);
        })
      }
      onAddHeader={() => commitScene((s) => addHeaderNavigationPreset(s))}
      onAddNavigationButton={() => commitScene((s) => addNavigationButtonToSelection(s))}
      onAddButton={() => commitScene((s) => addStandaloneButtonPreset(s))}
      onAddHero={() => commitScene((s) => addHeroPreset(s))}
      onAddCard={() => commitScene((s) => addCardPreset(s))}
      onAddInput={() => commitScene((s) => addInputFieldPreset(s))}
      onAddFooter={() => commitScene((s) => addFooterPreset(s))}
      onAddSidebar={() => commitScene((s) => addSidebarPreset(s))}
    />
  }
  logicContent={
    <>
      <div className="leftDrawerTitle">Logic</div>
      <div className="leftDrawerEmptyText">
        Тут згодом можна розмістити логіку взаємодій,
        прототипування або зв’язки між елементами.
      </div>
    </>
  }
  filesContent={
    <>
      <div className="leftDrawerTitle">File System</div>

      <div className="searchRow">
        <input placeholder="Find..." />
      </div>

      <div className="panelScroll">
        <LayersPanel
          scene={scene}
          onSelect={(sel) =>
            commitScene((prev) => ({
              ...prev,
              selection: sel,
            }))
          }
          onReorder={(activeId, overId) =>
            commitScene((prev) =>
              reorderNodeRelative(prev, activeId, overId)
            )
          }
          onToggleVisibility={(nodeId) =>
            commitScene((prev) => ({
              ...prev,
              nodes: prev.nodes.map((node) =>
                node.id === nodeId
                  ? ({ ...node, hidden: !node.hidden } as SceneNode)
                  : node
              ),
            }))
          }
        />
      </div>
    </>
  }
/>

        <main className="editorArea">
          <div className="canvasCard">
            <Editor
              scene={scene}
              onChange={commitScene}
              tool={tool}
              zoom={zoomPct / 100}
              onZoom={(z) => setZoomPct(Math.round(z * 100))}
              onAssignToFrame={(nodeId, frameId) =>
                commitScene((prev) => assignNodeToFrame(prev, nodeId, frameId))
              }
              onPlace={(artboardId, worldX, worldY) => {
                commitScene((s) => {
                  if (tool === "rect") return addRectAt(s, artboardId, worldX, worldY);
                  if (tool === "text") return addTextAt(s, artboardId, worldX, worldY);
                  if (tool === "line") return addLineAt(s, artboardId, worldX, worldY);
                  if (tool === "arrow") return addArrowAt(s, artboardId, worldX, worldY);
                  if (tool === "ellipse") return addEllipseAt(s, artboardId, worldX, worldY);
                  if (tool === "polygon") return addPolygonAt(s, artboardId, worldX, worldY);
                  if (tool === "star") return addStarAt(s, artboardId, worldX, worldY);
                  if (tool === "image") return addImageAt(s, artboardId, worldX, worldY);
                  return s;
                });

                if (tool !== "select" && tool !== "hand") {
                  setTool("select");
                }
              }}
            />
          </div>
        </main>

        <div
          className={`splitter ${draggingRight ? "dragging" : ""}`}
          onMouseDown={startResizeRight}
        />

        <aside className="sidePanel rightPanel">
          <div className="panelInner">
            <div className="panelScroll">
              <PropsPanel scene={scene} onChange={commitScene} />
            </div>
          </div>
        </aside>
      </div>

      <div className="bottomBarWrap">
        <BottomToolbar tool={tool} onTool={setTool} />
      </div>
    </div>
  );
}

type AppRoute =
  | { name: "landing" }
  | { name: "auth"; mode: "login" | "signup" }
  | { name: "projects" }
  | { name: "editor"; projectId: string };

function readRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("/auth/login")) return { name: "auth", mode: "login" };
  if (hash.startsWith("/auth")) return { name: "auth", mode: "signup" };
  if (hash.startsWith("/projects")) return { name: "projects" };
  if (hash.startsWith("/editor/")) {
    return { name: "editor", projectId: decodeURIComponent(hash.slice("/editor/".length)) };
  }
  return { name: "landing" };
}

function goTo(hash: string) {
  window.location.hash = hash;
}

function readSession(): AppSession | null {
  try {
    const raw = localStorage.getItem("orixSession");
    return raw ? (JSON.parse(raw) as AppSession) : null;
  } catch {
    return null;
  }
}

function readProjects(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem("orixProjects");
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length) {
      return parsed as ProjectRecord[];
    }

    const legacyScene = localStorage.getItem("figmaLiteScene");
    if (legacyScene) {
      const now = new Date().toISOString();
      return [
        {
          id: "legacy-project",
          name: "Imported editor project",
          description: "Automatically created from the previous standalone editor workspace.",
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    return [];
  } catch {
    return [];
  }
}

function saveProjects(projects: ProjectRecord[]) {
  localStorage.setItem("orixProjects", JSON.stringify(projects));
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRoute());
  const [session, setSession] = useState<AppSession | null>(() => readSession());
  const [projects, setProjects] = useState<ProjectRecord[]>(() => readProjects());

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    function onHashChange() {
      setRoute(readRoute());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if ((route.name === "projects" || route.name === "editor") && !session) {
      goTo("#/auth/login");
    }
  }, [route, session]);

  const touchProject = React.useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, updatedAt: new Date().toISOString() }
          : project
      )
    );
  }, []);

  function authenticate(nextSession: AppSession) {
    setSession(nextSession);
    localStorage.setItem("orixSession", JSON.stringify(nextSession));
    goTo("#/projects");
  }

  function logout() {
    setSession(null);
    localStorage.removeItem("orixSession");
    goTo("#/");
  }

  function createProject(payload: { name: string; description: string }) {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: uuid(),
      name: payload.name,
      description: payload.description,
      createdAt: now,
      updatedAt: now,
    };

    setProjects((prev) => [project, ...prev]);
  }

  function updateProject(id: string, payload: { name: string; description: string }) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id
          ? {
              ...project,
              name: payload.name,
              description: payload.description,
              updatedAt: new Date().toISOString(),
            }
          : project
      )
    );
  }

  function deleteProject(id: string) {
    setProjects((prev) => prev.filter((project) => project.id !== id));
    localStorage.removeItem(`orixScene:${id}`);
  }

  function openProject(id: string) {
    goTo(`#/editor/${encodeURIComponent(id)}`);
  }

  if (route.name === "auth") {
    return (
      <AuthPage
        initialMode={route.mode}
        onBack={() => goTo("#/")}
        onAuthenticated={authenticate}
      />
    );
  }

  if (route.name === "projects") {
    if (!session) {
      return (
        <AuthPage
          initialMode="login"
          onBack={() => goTo("#/")}
          onAuthenticated={authenticate}
        />
      );
    }

    return (
      <ProjectsPage
        session={session}
        projects={projects}
        onCreateProject={createProject}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
        onOpenProject={openProject}
        onLogout={logout}
        onGoHome={() => goTo("#/")}
      />
    );
  }

  if (route.name === "editor") {
    if (!session) {
      return (
        <AuthPage
          initialMode="login"
          onBack={() => goTo("#/")}
          onAuthenticated={authenticate}
        />
      );
    }

    const project = projects.find((item) => item.id === route.projectId);

    if (!project) {
      return (
        <ProjectsPage
          session={session}
          projects={projects}
          onCreateProject={createProject}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
          onOpenProject={openProject}
          onLogout={logout}
          onGoHome={() => goTo("#/")}
        />
      );
    }

    return (
      <EditorWorkspace
        projectId={project.id}
        projectName={project.name}
        onBackToProjects={() => goTo("#/projects")}
        onProjectTouched={() => touchProject(project.id)}
      />
    );
  }

  return (
    <LandingPage
      hasSession={!!session}
      onGetStarted={() => goTo(session ? "#/projects" : "#/auth")}
      onLogin={() => goTo("#/auth/login")}
      onProjects={() => goTo(session ? "#/projects" : "#/auth/login")}
    />
  );
}
