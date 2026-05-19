export type NodeType =
  | "rect"
  | "frame"
  | "text"
  | "line"
  | "arrow"
  | "ellipse"
  | "polygon"
  | "star"
  | "image";

export type SolidFillStyle = {
  kind: "solid";
  color: string;
  alpha: number;
};

export type GradientFillStyle = {
  kind: "gradient";
  from: string;
  to: string;
  alpha: number;
  angle: number;
};

export type ImageFillStyle = {
  kind: "image";
  src: string;
  fit: "cover" | "contain" | "stretch";
  opacity: number;
};

export type FillStyle = SolidFillStyle | GradientFillStyle | ImageFillStyle;

export type DropShadowEffect = {
  id: string;
  type: "drop-shadow";
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
};

export type InnerShadowEffect = {
  id: string;
  type: "inner-shadow";
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
};

export type LayerBlurEffect = {
  id: string;
  type: "layer-blur";
  enabled: boolean;
  mode: "uniform" | "progressive";
  blur: number;
};

export type BackgroundBlurEffect = {
  id: string;
  type: "background-blur";
  enabled: boolean;
  mode: "uniform" | "progressive";
  blur: number;
};

export type NodeEffect =
  | DropShadowEffect
  | InnerShadowEffect
  | LayerBlurEffect
  | BackgroundBlurEffect;

export type AutoLayoutDirection = "horizontal" | "vertical";
export type AutoLayoutAlign = "start" | "center" | "end" | "stretch";

export type AutoLayout = {
  enabled: boolean;
  direction: AutoLayoutDirection;
  gap: number;
  paddingX: number;
  paddingY: number;
  align: AutoLayoutAlign;
  hugContent: boolean;
};

export type ChildLayoutProps = {
  layoutWidth?: "fixed" | "fill";
  layoutHeight?: "fixed" | "fill";
  alignSelf?: "auto" | "start" | "center" | "end" | "stretch";
  ignoreAutoLayout?: boolean;
};

export type BaseNode = {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  artboardId: string;
  parentId?: string | null;
  childLayout?: ChildLayoutProps;
  effects?: NodeEffect[];
  hidden?: boolean;
};

export type RectNode = BaseNode & {
  type: "rect";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number | [number, number, number, number];
  fillStyle?: FillStyle;
};

export type FrameNode = BaseNode & {
  type: "frame";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number | [number, number, number, number];
  fillStyle?: FillStyle;
  autoLayout?: AutoLayout;
  clipContent?: boolean;
};

export type TextNode = BaseNode & {
  type: "text";
  text: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  align: "left" | "center" | "right";
  wrap: "word" | "char" | "none";
  lineHeight: number;
  letterSpacing: number;
  padding: number;
};

export type LineNode = BaseNode & {
  type: "line";
  stroke: string;
  strokeWidth: number;
};

export type ArrowNode = BaseNode & {
  type: "arrow";
  stroke: string;
  strokeWidth: number;
};

export type EllipseNode = BaseNode & {
  type: "ellipse";
  fill: string;
  stroke: string;
  strokeWidth: number;
  arcPercent: number;
  arcRotation: number;
  holePercent: number;
  centerOffsetPercent: number;
  fillStyle?: FillStyle;
};

export type PolygonNode = BaseNode & {
  type: "polygon";
  fill: string;
  stroke: string;
  strokeWidth: number;
  sides: number;
  fillStyle?: FillStyle;
};

export type StarNode = BaseNode & {
  type: "star";
  fill: string;
  stroke: string;
  strokeWidth: number;
  points: number;
  innerRatioPercent: number;
  fillStyle?: FillStyle;
};

export type ImageNode = BaseNode & {
  type: "image";
  src: string;
  fit: "cover" | "contain" | "stretch";
  stroke: string;
  strokeWidth: number;
};

export type SceneNode =
  | RectNode
  | FrameNode
  | TextNode
  | LineNode
  | ArrowNode
  | EllipseNode
  | PolygonNode
  | StarNode
  | ImageNode;

export type Artboard = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  fillStyle?: FillStyle;
};

export type Selection =
  | { kind: "none" }
  | { kind: "artboard"; id: string }
  | { kind: "node"; id: string };

export type Scene = {
  artboards: Artboard[];
  nodes: SceneNode[];
  selection: Selection;
};