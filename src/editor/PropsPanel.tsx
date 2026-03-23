import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Artboard,
  AutoLayout,
  BackgroundBlurEffect,
  FillStyle,
  GradientFillStyle,
  ImageFillStyle,
  NodeEffect,
  Scene,
  SceneNode,
  SolidFillStyle,
} from "../types";
import { clamp, findNode, isDescendant, isFrameNode, safeNumber } from "../utils";

type Props = {
  scene: Scene;
  onChange: (next: Scene) => void;
};

function getSelected(
  scene: Scene
): { kind: "none" } | { kind: "artboard"; item: Artboard } | { kind: "node"; item: SceneNode } {
  if (scene.selection.kind === "artboard") {
    const ab = scene.artboards.find((a) => a.id === scene.selection.id);
    return ab ? { kind: "artboard", item: ab } : { kind: "none" };
  }
  if (scene.selection.kind === "node") {
    const n = scene.nodes.find((x) => x.id === scene.selection.id);
    return n ? { kind: "node", item: n } : { kind: "none" };
  }
  return { kind: "none" };
}

function hexToRgb(hex: string) {
  let value = hex.replace("#", "").trim();
  if (value.length === 3) value = value.split("").map((ch) => ch + ch).join("");
  const num = Number.parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToHsv(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case rr:
        h = ((gg - bb) / d) % 6;
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      case bb:
        h = (rr - gg) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (h >= 0 && h < 60) {
    rr = c;
    gg = x;
    bb = 0;
  } else if (h < 120) {
    rr = x;
    gg = c;
    bb = 0;
  } else if (h < 180) {
    rr = 0;
    gg = c;
    bb = x;
  } else if (h < 240) {
    rr = 0;
    gg = x;
    bb = c;
  } else if (h < 300) {
    rr = x;
    gg = 0;
    bb = c;
  } else {
    rr = c;
    gg = 0;
    bb = x;
  }

  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}

function rgbaText(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
}

function ensureFillStyle(item: { fill?: string; fillStyle?: FillStyle }): FillStyle {
  if (item.fillStyle) return item.fillStyle;
  return {
    kind: "solid",
    color: item.fill ?? "#ffffff",
    alpha: 1,
  };
}

function getCornerValues(item: any): [number, number, number, number] {
  const raw = item.cornerRadius ?? 0;

  if (Array.isArray(raw)) {
    return [
      Number(raw[0] ?? 0),
      Number(raw[1] ?? raw[0] ?? 0),
      Number(raw[2] ?? raw[0] ?? 0),
      Number(raw[3] ?? raw[0] ?? 0),
    ];
  }

  const v = Number(raw ?? 0);
  return [v, v, v, v];
}

function cornerIcon(pos: "tl" | "tr" | "br" | "bl") {
  if (pos === "tl") return "◤";
  if (pos === "tr") return "◥";
  if (pos === "br") return "◢";
  return "◣";
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function effectTitle(type: NodeEffect["type"]) {
  if (type === "drop-shadow") return "Drop shadow";
  if (type === "inner-shadow") return "Inner shadow";
  if (type === "layer-blur") return "Layer blur";
  return "Background blur";
}

function makeDefaultEffect(type: NodeEffect["type"]): NodeEffect {
  if (type === "drop-shadow") {
    return {
      id: makeId(),
      type: "drop-shadow",
      enabled: true,
      x: 0,
      y: 4,
      blur: 4,
      spread: 0,
      color: "#000000",
      alpha: 0.25,
    };
  }

  if (type === "inner-shadow") {
    return {
      id: makeId(),
      type: "inner-shadow",
      enabled: true,
      x: 0,
      y: 4,
      blur: 4,
      spread: 0,
      color: "#000000",
      alpha: 0.25,
    };
  }

  if (type === "layer-blur") {
    return {
      id: makeId(),
      type: "layer-blur",
      enabled: true,
      mode: "uniform",
      blur: 4,
    };
  }

  return {
    id: makeId(),
    type: "background-blur",
    enabled: true,
    mode: "uniform",
    blur: 4,
  };
}

function getNodeEffects(item: SceneNode | null): NodeEffect[] {
  if (!item) return [];
  return Array.isArray((item as any).effects) ? ((item as any).effects as NodeEffect[]) : [];
}

function RowInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="propsRowInput">
      <div className="propsRowLabel">{label}</div>
      <input
        className="propsInput"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SizePreview({ width, height }: { width: number; height: number }) {
  return (
    <div className="propsSizePreview">
      <div className="propsSizePreviewBox">
        <div className="propsSizePreviewTop">w {Math.round(width)}</div>
        <div className="propsSizePreviewLeft">h {Math.round(height)}</div>
      </div>
    </div>
  );
}

function FillModeTabs({
  value,
  onChange,
}: {
  value: FillStyle["kind"];
  onChange: (kind: FillStyle["kind"]) => void;
}) {
  const items: Array<{ key: FillStyle["kind"]; label: string }> = [
    { key: "solid", label: "■" },
    { key: "gradient", label: "◪" },
    { key: "image", label: "▧" },
  ];

  return (
    <div className="fillModeTabs">
      {items.map((item) => (
        <button
          key={item.key}
          className={`fillModeBtn ${value === item.key ? "active" : ""}`}
          onClick={() => onChange(item.key)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function FillPreview({ fillStyle }: { fillStyle: FillStyle }) {
  if (fillStyle.kind === "solid") {
    return (
      <span
        className="fillPreviewSwatch"
        style={{ background: fillStyle.color, opacity: fillStyle.alpha }}
      />
    );
  }

  if (fillStyle.kind === "gradient") {
    return (
      <span
        className="fillPreviewSwatch"
        style={{
          background: `linear-gradient(${fillStyle.angle}deg, ${fillStyle.from}, ${fillStyle.to})`,
          opacity: fillStyle.alpha,
        }}
      />
    );
  }

  if (fillStyle.kind === "image" && fillStyle.src) {
    return (
      <span
        className="fillPreviewSwatch"
        style={{
          backgroundImage: `url(${fillStyle.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: fillStyle.opacity,
        }}
      />
    );
  }

  return <span className="fillPreviewSwatch" style={{ background: "#666" }} />;
}

function FillPopover({
  fillStyle,
  onChange,
  onClose,
  anchorRect,
}: {
  fillStyle: FillStyle;
  onChange: (next: FillStyle) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const [gradientStop, setGradientStop] = useState<"from" | "to">("from");
  const areaRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const [position, setPosition] = useState(() => ({
    x: anchorRect ? Math.max(16, anchorRect.left - 426) : 120,
    y: anchorRect ? Math.max(16, anchorRect.top - 40) : 120,
  }));

  useEffect(() => {
    if (!anchorRect) return;
    setPosition({
      x: Math.max(16, anchorRect.left - 426),
      y: Math.max(16, anchorRect.top - 40),
    });
  }, [anchorRect]);

  const currentColor =
    fillStyle.kind === "solid"
      ? fillStyle.color
      : fillStyle.kind === "gradient"
      ? gradientStop === "from"
        ? fillStyle.from
        : fillStyle.to
      : "#ff0000";

  const currentAlpha = fillStyle.kind === "image" ? fillStyle.opacity : fillStyle.alpha;

  const rgb = useMemo(() => hexToRgb(currentColor), [currentColor]);
  const hsv = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb]);

  const [localHue, setLocalHue] = useState(hsv.h);
  const [localS, setLocalS] = useState(hsv.s);
  const [localV, setLocalV] = useState(hsv.v);
  const [rgbaValue, setRgbaValue] = useState(rgbaText(currentColor, currentAlpha));

  useEffect(() => {
    setLocalHue(hsv.h);
    setLocalS(hsv.s);
    setLocalV(hsv.v);
    setRgbaValue(rgbaText(currentColor, currentAlpha));
  }, [currentColor, currentAlpha, hsv.h, hsv.s, hsv.v]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) onClose();
    }

    window.addEventListener("pointerdown", onDocPointerDown);
    return () => window.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...position };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setPosition({
        x: Math.max(8, startPos.x + dx),
        y: Math.max(8, startPos.y + dy),
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function switchMode(kind: FillStyle["kind"]) {
    if (kind === "solid") {
      onChange({
        kind: "solid",
        color:
          fillStyle.kind === "solid"
            ? fillStyle.color
            : fillStyle.kind === "gradient"
            ? fillStyle.from
            : "#ff0000",
        alpha: fillStyle.kind === "image" ? fillStyle.opacity : currentAlpha,
      } satisfies SolidFillStyle);
      return;
    }

    if (kind === "gradient") {
      onChange({
        kind: "gradient",
        from:
          fillStyle.kind === "solid"
            ? fillStyle.color
            : fillStyle.kind === "gradient"
            ? fillStyle.from
            : "#ff0000",
        to: fillStyle.kind === "gradient" ? fillStyle.to : "#000000",
        alpha: fillStyle.kind === "image" ? fillStyle.opacity : currentAlpha,
        angle: fillStyle.kind === "gradient" ? fillStyle.angle : 45,
      } satisfies GradientFillStyle);
      return;
    }

    onChange({
      kind: "image",
      src: fillStyle.kind === "image" ? fillStyle.src : "",
      fit: fillStyle.kind === "image" ? fillStyle.fit : "cover",
      opacity: fillStyle.kind === "image" ? fillStyle.opacity : currentAlpha,
    } satisfies ImageFillStyle);
  }

  function applyColor(hex: string, alpha: number) {
    if (fillStyle.kind === "solid") {
      onChange({ ...fillStyle, color: hex, alpha });
      return;
    }

    if (fillStyle.kind === "gradient") {
      onChange({
        ...fillStyle,
        [gradientStop]: hex,
        alpha,
      });
    }
  }

  function pickFromPointer(clientX: number, clientY: number) {
    const el = areaRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);

    const nextS = rect.width === 0 ? 0 : x / rect.width;
    const nextV = rect.height === 0 ? 0 : 1 - y / rect.height;

    setLocalS(nextS);
    setLocalV(nextV);

    const rgbColor = hsvToRgb(localHue, nextS, nextV);
    applyColor(rgbToHex(rgbColor.r, rgbColor.g, rgbColor.b), currentAlpha);
  }

  function onAreaPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    pickFromPointer(e.clientX, e.clientY);

    const move = (ev: PointerEvent) => pickFromPointer(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className="fillPopover fillPopoverFloating"
      ref={popRef}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ left: position.x, top: position.y }}
    >
      <div className="fillPopoverDragBar" onPointerDown={startDrag}>
        <div className="fillPopoverDragTitle">Fill</div>
        <button type="button" className="fillPopoverClose" onClick={onClose}>
          ×
        </button>
      </div>

      <FillModeTabs value={fillStyle.kind} onChange={switchMode} />

      {fillStyle.kind !== "image" ? (
        <>
          {fillStyle.kind === "gradient" && (
            <div className="gradientStopsRow">
              <button
                className={`gradientStopBtn ${gradientStop === "from" ? "active" : ""}`}
                onClick={() => setGradientStop("from")}
                type="button"
              >
                <span className="gradientStopSwatch" style={{ background: fillStyle.from }} />
                From
              </button>
              <button
                className={`gradientStopBtn ${gradientStop === "to" ? "active" : ""}`}
                onClick={() => setGradientStop("to")}
                type="button"
              >
                <span className="gradientStopSwatch" style={{ background: fillStyle.to }} />
                To
              </button>
            </div>
          )}

          <div
            ref={areaRef}
            className="colorArea"
            onPointerDown={onAreaPointerDown}
            style={{ backgroundColor: `hsl(${localHue}, 100%, 50%)` }}
          >
            <div className="colorAreaWhite" />
            <div className="colorAreaBlack" />
            <div
              className="colorAreaThumb"
              style={{
                left: `${localS * 100}%`,
                top: `${(1 - localV) * 100}%`,
              }}
            />
          </div>

          <div className="fillSliderRow">
            <div className="fillEyedropper">◌</div>
            <div className="fillSliderCol">
              <input
                className="fillHueSlider"
                type="range"
                min={0}
                max={360}
                value={localHue}
                onChange={(e) => {
                  const nextHue = Number(e.target.value);
                  setLocalHue(nextHue);
                  const rgbColor = hsvToRgb(nextHue, localS, localV);
                  applyColor(rgbToHex(rgbColor.r, rgbColor.g, rgbColor.b), currentAlpha);
                }}
              />

              <div className="fillAlphaWrap">
                <div className="fillAlphaChecker" />
                <input
                  className="fillAlphaSlider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(currentAlpha * 100)}
                  onChange={(e) => {
                    const nextAlpha = clamp(Number(e.target.value) / 100, 0, 1);
                    applyColor(currentColor, nextAlpha);
                  }}
                />
              </div>
            </div>
          </div>

          {fillStyle.kind === "gradient" && (
            <div className="propsRowInput">
              <div className="propsRowLabel">Angle</div>
              <input
                className="propsInput"
                type="number"
                value={fillStyle.angle}
                onChange={(e) =>
                  onChange({
                    ...fillStyle,
                    angle: safeNumber(e.target.value, fillStyle.angle),
                  })
                }
              />
            </div>
          )}

          <input
            className="fillRgbaInput"
            value={rgbaValue}
            onChange={(e) => setRgbaValue(e.target.value)}
            onBlur={() => {
              const text = rgbaValue.trim();
              if (text.startsWith("#")) {
                applyColor(text, currentAlpha);
                return;
              }
              setRgbaValue(rgbaText(currentColor, currentAlpha));
            }}
          />
        </>
      ) : (
        <div className="imageFillBlock">
          <label className="imageUploadBtn">
            Upload image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                  onChange({
                    ...fillStyle,
                    src: String(reader.result ?? ""),
                  });
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>

          <input
            className="fillTextInput"
            placeholder="Image URL or data URL"
            value={fillStyle.src}
            onChange={(e) =>
              onChange({
                ...fillStyle,
                src: e.target.value,
              })
            }
          />

          <div className="propsGrid2">
            <div className="propsRowInput">
              <div className="propsRowLabel">Fit</div>
              <select
                className="propsInput"
                value={fillStyle.fit}
                onChange={(e) =>
                  onChange({
                    ...fillStyle,
                    fit: e.target.value as ImageFillStyle["fit"],
                  })
                }
              >
                <option value="cover">cover</option>
                <option value="contain">contain</option>
                <option value="stretch">stretch</option>
              </select>
            </div>

            <div className="propsRowInput">
              <div className="propsRowLabel">Alpha</div>
              <input
                className="propsInput"
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={fillStyle.opacity}
                onChange={(e) =>
                  onChange({
                    ...fillStyle,
                    opacity: clamp(Number(e.target.value || 1), 0, 1),
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EffectsPickerPopover({
  anchorRect,
  onClose,
  onAdd,
}: {
  anchorRect: DOMRect | null;
  onClose: () => void;
  onAdd: (type: NodeEffect["type"]) => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);
  const [kind, setKind] = useState<NodeEffect["type"]>("drop-shadow");
  const [position, setPosition] = useState(() => ({
    x: anchorRect ? Math.max(16, anchorRect.left - 320) : 140,
    y: anchorRect ? Math.max(16, anchorRect.top + 10) : 140,
  }));

  useEffect(() => {
    if (!anchorRect) return;
    setPosition({
      x: Math.max(16, anchorRect.left - 320),
      y: Math.max(16, anchorRect.top + 10),
    });
  }, [anchorRect]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) onClose();
    }

    window.addEventListener("pointerdown", onDocPointerDown);
    return () => window.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...position };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setPosition({
        x: Math.max(8, startPos.x + dx),
        y: Math.max(8, startPos.y + dy),
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={popRef}
      className="effectsPopover"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="effectsPopoverHeader" onPointerDown={startDrag}>
        <div className="effectsPopoverTitle">Effect</div>
        <button type="button" className="effectsCloseBtn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="effectsTabs">
        {(
          [
            "drop-shadow",
            "inner-shadow",
            "layer-blur",
            "background-blur",
          ] as NodeEffect["type"][]
        ).map((type) => (
          <button
            key={type}
            type="button"
            className={`effectsTabBtn ${kind === type ? "active" : ""}`}
            onClick={() => setKind(type)}
          >
            {effectTitle(type)}
          </button>
        ))}
      </div>

      <div className="effectsPopoverFooter">
        <button
          type="button"
          className="effectsAddBtn"
          onClick={() => {
            onAdd(kind);
            onClose();
          }}
        >
          Add effect
        </button>
      </div>
    </div>
  );
}

function EffectEditorPopover({
  effect,
  anchorRect,
  onClose,
  onPatch,
  onOpenColor,
}: {
  effect: NodeEffect;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onPatch: (patch: Partial<NodeEffect>) => void;
  onOpenColor: (rect: DOMRect | null) => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(() => ({
    x: anchorRect ? Math.max(16, anchorRect.left - 320) : 160,
    y: anchorRect ? Math.max(16, anchorRect.top + 10) : 160,
  }));

  useEffect(() => {
    if (!anchorRect) return;
    setPosition({
      x: Math.max(16, anchorRect.left - 320),
      y: Math.max(16, anchorRect.top + 10),
    });
  }, [anchorRect]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) onClose();
    }

    window.addEventListener("pointerdown", onDocPointerDown);
    return () => window.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...position };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setPosition({
        x: Math.max(8, startPos.x + dx),
        y: Math.max(8, startPos.y + dy),
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={popRef}
      className="effectEditorPopover"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="effectEditorHeader" onPointerDown={startDrag}>
        <div className="effectEditorTitle">{effectTitle(effect.type)}</div>

        <div className="effectEditorHeaderActions">
          <label className="effectToggleWrap">
            <input
              type="checkbox"
              checked={effect.enabled}
              onChange={(e) => onPatch({ enabled: e.target.checked } as Partial<NodeEffect>)}
            />
          </label>

          <button type="button" className="effectsCloseBtn" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      {(effect.type === "drop-shadow" || effect.type === "inner-shadow") && (
        <div className="effectEditorBody">
          <div className="propsGrid2">
            <RowInput
              label="X"
              type="number"
              value={effect.x}
              onChange={(value) => onPatch({ x: safeNumber(value, effect.x) } as any)}
            />
            <RowInput
              label="Y"
              type="number"
              value={effect.y}
              onChange={(value) => onPatch({ y: safeNumber(value, effect.y) } as any)}
            />
          </div>

          <div className="propsGrid2">
            <RowInput
              label="Blur"
              type="number"
              value={effect.blur}
              onChange={(value) =>
                onPatch({ blur: clamp(safeNumber(value, effect.blur), 0, 100) } as any)
              }
            />
            <RowInput
              label="Spread"
              type="number"
              value={effect.spread}
              onChange={(value) =>
                onPatch({ spread: clamp(safeNumber(value, effect.spread), 0, 100) } as any)
              }
            />
          </div>

          <div className="propsGrid2">
            <div className="propsRowInput">
              <div className="propsRowLabel">Color</div>
              <button
                type="button"
                className="effectColorBtn"
                style={{ background: effect.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenColor((e.currentTarget as HTMLButtonElement).getBoundingClientRect());
                }}
              />
            </div>

            <RowInput
              label="Alpha %"
              type="number"
              value={Math.round(effect.alpha * 100)}
              onChange={(value) =>
                onPatch({
                  alpha: clamp(safeNumber(value, effect.alpha * 100) / 100, 0, 1),
                } as any)
              }
            />
          </div>
        </div>
      )}

      {(effect.type === "layer-blur" || effect.type === "background-blur") && (
        <div className="effectEditorBody">
          <div className="propsGrid2">
            <div className="propsRowInput">
              <div className="propsRowLabel">Mode</div>
              <select
                className="propsInput"
                value={effect.mode}
                onChange={(e) =>
                  onPatch({
                    mode: e.target.value as "uniform" | "progressive",
                  } as any)
                }
              >
                <option value="uniform">uniform</option>
                <option value="progressive">progressive</option>
              </select>
            </div>

            <RowInput
              label="Blur"
              type="number"
              value={effect.blur}
              onChange={(value) =>
                onPatch({ blur: clamp(safeNumber(value, effect.blur), 0, 100) } as any)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultAutoLayout(): AutoLayout {
  return {
    enabled: true,
    direction: "vertical",
    gap: 12,
    paddingX: 16,
    paddingY: 16,
    align: "start",
    hugContent: false,
  };
}

export default function PropsPanel({ scene, onChange }: Props) {
  const selected = useMemo(() => getSelected(scene), [scene]);

  const [fillPickerOpen, setFillPickerOpen] = useState(false);
  const [fillAnchorRect, setFillAnchorRect] = useState<DOMRect | null>(null);
  const fillButtonRef = useRef<HTMLButtonElement | null>(null);

  const [strokePickerOpen, setStrokePickerOpen] = useState(false);
  const [strokeAnchorRect, setStrokeAnchorRect] = useState<DOMRect | null>(null);
  const strokeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [strokeOpen, setStrokeOpen] = useState(false);
  const [cornerOpen, setCornerOpen] = useState(false);

  const [effectsPickerOpen, setEffectsPickerOpen] = useState(false);
  const [effectsAnchorRect, setEffectsAnchorRect] = useState<DOMRect | null>(null);
  const effectsButtonRef = useRef<HTMLButtonElement | null>(null);

  const [activeEffectEditorId, setActiveEffectEditorId] = useState<string | null>(null);
  const [activeEffectEditorAnchor, setActiveEffectEditorAnchor] = useState<DOMRect | null>(null);

  const [effectColorPickerId, setEffectColorPickerId] = useState<string | null>(null);
  const [effectColorAnchorRect, setEffectColorAnchorRect] = useState<DOMRect | null>(null);

  const isNone = selected.kind === "none";
  const isArtboard = selected.kind === "artboard";
  const item = selected.kind === "none" ? null : selected.item;

  const isFilledShape =
    !!item &&
    !isArtboard &&
    (item.type === "rect" ||
      item.type === "frame" ||
      item.type === "ellipse" ||
      item.type === "polygon" ||
      item.type === "star");

  const isStrokeShape =
    !!item &&
    !isArtboard &&
    (item.type === "rect" ||
      item.type === "frame" ||
      item.type === "ellipse" ||
      item.type === "polygon" ||
      item.type === "star" ||
      item.type === "line" ||
      item.type === "arrow" ||
      item.type === "image");

  const strokeEnabled = !!item && isStrokeShape && ((item as any).strokeWidth ?? 0) > 0;

  useEffect(() => {
    setStrokeOpen(strokeEnabled);
  }, [strokeEnabled, item?.id]);

  useEffect(() => {
    setFillPickerOpen(false);
    setStrokePickerOpen(false);
    setEffectsPickerOpen(false);
    setActiveEffectEditorId(null);
    setEffectColorPickerId(null);
  }, [scene.selection]);

  useEffect(() => {
    if (!item) {
      setCornerOpen(false);
      return;
    }

    if (item.type !== "rect" && item.type !== "frame") {
      setCornerOpen(false);
    }
  }, [item?.id, item?.type]);

  function patchArtboard(id: string, patch: Partial<Artboard>) {
    onChange({
      ...scene,
      artboards: scene.artboards.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  function patchNode(id: string, patch: Partial<SceneNode>) {
    onChange({
      ...scene,
      nodes: scene.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as SceneNode) : n)),
    });
  }

  if (isNone || !item) {
    return (
      <div className="panel right">
        <div className="panelInner propsPanelModern">
          <div className="propsHeader">Properties</div>
          <div className="propsEmpty">Вибери артборд або об’єкт.</div>
        </div>
      </div>
    );
  }

  const fillStyle =
    isArtboard ||
    item.type === "rect" ||
    item.type === "frame" ||
    item.type === "ellipse" ||
    item.type === "polygon" ||
    item.type === "star"
      ? ensureFillStyle(item as any)
      : null;

  const updateFill = (next: FillStyle) => {
    if (!fillStyle) return;

    if (isArtboard) {
      patchArtboard(item.id, {
        fillStyle: next,
        fill: next.kind === "solid" ? next.color : (item as any).fill,
      });
      return;
    }

    patchNode(
      item.id,
      {
        fillStyle: next,
        fill: next.kind === "solid" ? next.color : (item as any).fill,
      } as any
    );
  };

  const strokeFillStyle: FillStyle | null =
    !isArtboard && isStrokeShape
      ? {
          kind: "solid",
          color: (item as any).stroke ?? "#c54848",
          alpha: 1,
        }
      : null;

  const updateStrokeColor = (next: FillStyle) => {
    if (!item || isArtboard) return;
    if (next.kind !== "solid") return;
    patchNode(item.id, { stroke: next.color } as any);
  };

  const enableStroke = () => {
    if (!isStrokeShape) return;
    patchNode(item.id, { strokeWidth: Math.max(1, (item as any).strokeWidth ?? 1) } as any);
    setStrokeOpen(true);
  };

  const disableStroke = () => {
    if (!isStrokeShape) return;
    patchNode(item.id, { strokeWidth: 0 } as any);
    setStrokeOpen(false);
    setStrokePickerOpen(false);
  };

  const nodeEffects = !isArtboard ? getNodeEffects(item as SceneNode) : [];
  const activeEffect =
    activeEffectEditorId != null
      ? nodeEffects.find((effect) => effect.id === activeEffectEditorId) ?? null
      : null;

  const colorEffect =
    effectColorPickerId != null
      ? nodeEffects.find((effect) => effect.id === effectColorPickerId) ?? null
      : null;

  function addEffect(type: NodeEffect["type"]) {
    if (isArtboard || !item) return;
    const nextEffect = makeDefaultEffect(type);
    const current = getNodeEffects(item as SceneNode);

    patchNode(item.id, {
      effects: [...current, nextEffect],
    } as any);
  }

  function patchEffect(effectId: string, patch: Partial<NodeEffect>) {
    if (isArtboard || !item) return;
    const current = getNodeEffects(item as SceneNode);

    patchNode(item.id, {
      effects: current.map((effect) =>
        effect.id === effectId ? ({ ...effect, ...patch } as NodeEffect) : effect
      ),
    } as any);
  }

  function removeEffect(effectId: string) {
    if (isArtboard || !item) return;
    const current = getNodeEffects(item as SceneNode);

    patchNode(item.id, {
      effects: current.filter((effect) => effect.id !== effectId),
    } as any);
  }

  const frameCandidates =
    !isArtboard && item
      ? scene.nodes.filter(
          (n) =>
            n.type === "frame" &&
            n.artboardId === item.artboardId &&
            n.id !== item.id &&
            !isDescendant(scene, n.id, item.id)
        )
      : [];

  return (
    <div className="panel right">
      <div className="panelInner propsPanelModern">
        <div className="propsHeader">Properties</div>
        <div className="propsSubtle">
          {isArtboard ? "Artboard" : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
        </div>

        <div className="propsSection">
          <RowInput
            label="Name"
            value={(item as any).name}
            onChange={(value) =>
              isArtboard
                ? patchArtboard(item.id, { name: value })
                : patchNode(item.id, { name: value })
            }
          />
        </div>

        <div className="propsSectionTitle">Position</div>
        <div className="propsGrid2">
          <RowInput
            label="X"
            type="number"
            value={Math.round((item as any).x)}
            onChange={(value) =>
              isArtboard
                ? patchArtboard(item.id, { x: safeNumber(value, (item as any).x) })
                : patchNode(item.id, { x: safeNumber(value, (item as any).x) })
            }
          />
          <RowInput
            label="Y"
            type="number"
            value={Math.round((item as any).y)}
            onChange={(value) =>
              isArtboard
                ? patchArtboard(item.id, { y: safeNumber(value, (item as any).y) })
                : patchNode(item.id, { y: safeNumber(value, (item as any).y) })
            }
          />
        </div>

        <div className="propsSectionTitle">Size</div>
        <SizePreview width={(item as any).width} height={(item as any).height} />
        <div className="propsGrid2">
          <RowInput
            label="W"
            type="number"
            value={Math.round((item as any).width)}
            onChange={(value) =>
              isArtboard
                ? patchArtboard(item.id, {
                    width: clamp(safeNumber(value, (item as any).width), 320, 5000),
                  })
                : patchNode(item.id, {
                    width: clamp(safeNumber(value, (item as any).width), 10, 5000),
                  })
            }
          />
          <RowInput
            label="H"
            type="number"
            value={Math.round((item as any).height)}
            onChange={(value) =>
              isArtboard
                ? patchArtboard(item.id, {
                    height: clamp(safeNumber(value, (item as any).height), 240, 5000),
                  })
                : patchNode(item.id, {
                    height: clamp(safeNumber(value, (item as any).height), 10, 5000),
                  })
            }
          />
        </div>

        {!isArtboard && (
          <>
            <div className="propsSectionTitle">Hierarchy</div>
            <div className="propsRowInput">
              <div className="propsRowLabel">Parent frame</div>
              <select
                className="propsInput"
                value={(item.parentId ?? "") as string}
                onChange={(e) => {
                  const frameId = e.target.value || null;
                  onChange({
                    ...scene,
                    nodes: scene.nodes.map((n) =>
                      n.id === item.id ? ({ ...n, parentId: frameId } as SceneNode) : n
                    ),
                  });
                }}
              >
                <option value="">None</option>
                {frameCandidates.map((frame) => (
                  <option key={frame.id} value={frame.id}>
                    {frame.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {!isArtboard && (
          <div className="cornerOpacityRow">
            {(item as any).type === "rect" || (item as any).type === "frame" ? (
              <div className="cornerBlock">
                <div className="cornerOpacityLabel">Corner</div>

                <div className="cornerCard">
                  <div className="cornerSingleBar">
                    <input
                      className="cornerSingleInput"
                      type="number"
                      min={0}
                      max={300}
                      value={Math.round(getCornerValues(item)[0])}
                      onChange={(e) => {
                        const next = clamp(
                          safeNumber(e.target.value, getCornerValues(item)[0]),
                          0,
                          300
                        );

                        patchNode(item.id, {
                          cornerRadius: next,
                        } as any);
                      }}
                    />

                    {!cornerOpen ? (
                      <button
                        type="button"
                        className="cornerCardBtn"
                        onClick={() => {
                          const [tl, tr, br, bl] = getCornerValues(item);
                          patchNode(item.id, {
                            cornerRadius: [tl, tr, br, bl],
                          } as any);
                          setCornerOpen(true);
                        }}
                        title="Expand corner radius"
                      >
                        +
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cornerCardBtn"
                        onClick={() => {
                          const [tl] = getCornerValues(item);
                          patchNode(item.id, {
                            cornerRadius: tl,
                          } as any);
                          setCornerOpen(false);
                        }}
                        title="Collapse corner radius"
                      >
                        −
                      </button>
                    )}
                  </div>
                </div>

                {cornerOpen && (
                  <div className="cornerGrid">
                    {(
                      [
                        { key: "tl", index: 0 },
                        { key: "tr", index: 1 },
                        { key: "bl", index: 3 },
                        { key: "br", index: 2 },
                      ] as const
                    ).map((corner) => {
                      const corners = getCornerValues(item);

                      return (
                        <div key={corner.key} className="cornerMiniField">
                          <span className="cornerMiniIcon">{cornerIcon(corner.key)}</span>

                          <input
                            className="cornerMiniInput"
                            type="number"
                            min={0}
                            max={300}
                            value={Math.round(corners[corner.index])}
                            onChange={(e) => {
                              const next = [...corners] as [number, number, number, number];
                              next[corner.index] = clamp(
                                safeNumber(e.target.value, corners[corner.index]),
                                0,
                                300
                              );

                              patchNode(item.id, {
                                cornerRadius: next,
                              } as any);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="cornerBlock">
                <div className="cornerOpacityLabel">Corner</div>
                <div className="cornerCard disabled">
                  <div className="cornerSingleBar">
                    <input className="cornerSingleInput" type="text" value="—" readOnly />
                  </div>
                </div>
              </div>
            )}

            <div className="opacityBlock">
              <div className="cornerOpacityLabel">Opacity</div>

              <div className="opacityCard">
                <input
                  className="opacityInput"
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(((item as any).opacity ?? 1) * 100)}
                  onChange={(e) =>
                    patchNode(item.id, {
                      opacity: clamp(
                        safeNumber(
                          e.target.value,
                          Math.round(((item as any).opacity ?? 1) * 100)
                        ) / 100,
                        0,
                        1
                      ),
                    } as any)
                  }
                />
                <span className="opacitySuffix">%</span>
              </div>
            </div>
          </div>
        )}

        {!isArtboard && item.type === "rect" && (
          <>
            <div className="propsSectionTitle">Frame</div>
            <button
              className="primary"
              type="button"
              onClick={() => {
                patchNode(item.id, {
                  type: "frame",
                  clipContent: true,
                  autoLayout: getDefaultAutoLayout(),
                } as any);
              }}
            >
              Convert rect to frame
            </button>
          </>
        )}

        {!isArtboard && item.type === "frame" && (
          <>
            <div className="propsSectionTitle">Auto Layout</div>

            <div className="propsGrid2">
              <div className="propsRowInput">
                <div className="propsRowLabel">Enabled</div>
                <select
                  className="propsInput"
                  value={item.autoLayout?.enabled ? "yes" : "no"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      autoLayout: {
                        ...(item.autoLayout ?? getDefaultAutoLayout()),
                        enabled: e.target.value === "yes",
                      },
                    } as any)
                  }
                >
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </div>

              <div className="propsRowInput">
                <div className="propsRowLabel">Direction</div>
                <select
                  className="propsInput"
                  value={item.autoLayout?.direction ?? "vertical"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      autoLayout: {
                        ...(item.autoLayout ?? getDefaultAutoLayout()),
                        direction: e.target.value as AutoLayout["direction"],
                      },
                    } as any)
                  }
                >
                  <option value="horizontal">horizontal</option>
                  <option value="vertical">vertical</option>
                </select>
              </div>
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Gap"
                type="number"
                value={item.autoLayout?.gap ?? 12}
                onChange={(value) =>
                  patchNode(item.id, {
                    autoLayout: {
                      ...(item.autoLayout ?? getDefaultAutoLayout()),
                      gap: clamp(safeNumber(value, item.autoLayout?.gap ?? 12), 0, 400),
                    },
                  } as any)
                }
              />
              <div className="propsRowInput">
                <div className="propsRowLabel">Align</div>
                <select
                  className="propsInput"
                  value={item.autoLayout?.align ?? "start"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      autoLayout: {
                        ...(item.autoLayout ?? getDefaultAutoLayout()),
                        align: e.target.value as AutoLayout["align"],
                      },
                    } as any)
                  }
                >
                  <option value="start">start</option>
                  <option value="center">center</option>
                  <option value="end">end</option>
                </select>
              </div>
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Padding X"
                type="number"
                value={item.autoLayout?.paddingX ?? 16}
                onChange={(value) =>
                  patchNode(item.id, {
                    autoLayout: {
                      ...(item.autoLayout ?? getDefaultAutoLayout()),
                      paddingX: clamp(safeNumber(value, item.autoLayout?.paddingX ?? 16), 0, 400),
                    },
                  } as any)
                }
              />
              <RowInput
                label="Padding Y"
                type="number"
                value={item.autoLayout?.paddingY ?? 16}
                onChange={(value) =>
                  patchNode(item.id, {
                    autoLayout: {
                      ...(item.autoLayout ?? getDefaultAutoLayout()),
                      paddingY: clamp(safeNumber(value, item.autoLayout?.paddingY ?? 16), 0, 400),
                    },
                  } as any)
                }
              />
            </div>

            <div className="propsGrid2">
              <div className="propsRowInput">
                <div className="propsRowLabel">Hug content</div>
                <select
                  className="propsInput"
                  value={item.autoLayout?.hugContent ? "yes" : "no"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      autoLayout: {
                        ...(item.autoLayout ?? getDefaultAutoLayout()),
                        hugContent: e.target.value === "yes",
                      },
                    } as any)
                  }
                >
                  <option value="no">no</option>
                  <option value="yes">yes</option>
                </select>
              </div>

              <div className="propsRowInput">
                <div className="propsRowLabel">Clip content</div>
                <select
                  className="propsInput"
                  value={item.clipContent ? "yes" : "no"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      clipContent: e.target.value === "yes",
                    } as any)
                  }
                >
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </div>
            </div>
          </>
        )}

        {(isArtboard || isFilledShape) && fillStyle && (
          <>
            <div className="propsSectionTitle">Appearance</div>

            <div className="fillPopoverAnchor">
              <button
                ref={fillButtonRef}
                type="button"
                className="propsColorRow fillTriggerBtn"
                onClick={() => {
                  const rect = fillButtonRef.current?.getBoundingClientRect() ?? null;
                  setFillAnchorRect(rect);
                  setFillPickerOpen((v) => !v);
                }}
              >
                <div className="propsColorLabel">Fill</div>
                <FillPreview fillStyle={fillStyle} />
              </button>

              {fillPickerOpen && (
                <FillPopover
                  fillStyle={fillStyle}
                  anchorRect={fillAnchorRect}
                  onChange={updateFill}
                  onClose={() => setFillPickerOpen(false)}
                />
              )}
            </div>
          </>
        )}

        {isStrokeShape && (
          <div className="strokeBlock">
            <div className="strokeHeaderCard">
              <div className="strokeHeaderTitle">Stroke</div>

              {!strokeEnabled ? (
                <button
                  type="button"
                  className="strokeHeaderBtn"
                  onClick={enableStroke}
                  title="Enable stroke"
                >
                  +
                </button>
              ) : (
                <button
                  type="button"
                  className="strokeHeaderBtn"
                  onClick={disableStroke}
                  title="Disable stroke"
                >
                  −
                </button>
              )}
            </div>

            {strokeEnabled && strokeOpen && (
              <div className="strokeControlsCard">
                <div className="strokeControlsRow">
                  <div className="strokeWeightBox">
                    <span className="strokeWeightLabel">Weight</span>
                    <input
                      className="strokeWeightInput"
                      type="number"
                      min={0}
                      max={50}
                      value={(item as any).strokeWidth ?? 1}
                      onChange={(e) =>
                        patchNode(
                          item.id,
                          {
                            strokeWidth: clamp(
                              safeNumber(e.target.value, (item as any).strokeWidth ?? 1),
                              0,
                              50
                            ),
                          } as any
                        )
                      }
                    />
                  </div>

                  <div className="strokeColorWrap">
                    <button
                      ref={strokeButtonRef}
                      type="button"
                      className="strokeColorInput strokeColorBtn"
                      onClick={() => {
                        const rect = strokeButtonRef.current?.getBoundingClientRect() ?? null;
                        setStrokeAnchorRect(rect);
                        setStrokePickerOpen((v) => !v);
                      }}
                      aria-label="Open stroke color picker"
                      style={{
                        background: (item as any).stroke || "#c54848",
                      }}
                    />
                  </div>
                </div>

                {strokePickerOpen && strokeFillStyle && (
                  <FillPopover
                    fillStyle={strokeFillStyle}
                    anchorRect={strokeAnchorRect}
                    onChange={updateStrokeColor}
                    onClose={() => setStrokePickerOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {!isArtboard && (
          <div className="effectsBlock">
            <div className="effectsHeaderCard">
              <div className="effectsHeaderTitle">Effects</div>
              <button
                ref={effectsButtonRef}
                type="button"
                className="effectsHeaderBtn"
                onClick={() => {
                  const rect = effectsButtonRef.current?.getBoundingClientRect() ?? null;
                  setEffectsAnchorRect(rect);
                  setEffectsPickerOpen((v) => !v);
                }}
                title="Add effect"
              >
                +
              </button>
            </div>

            {effectsPickerOpen && (
              <EffectsPickerPopover
                anchorRect={effectsAnchorRect}
                onClose={() => setEffectsPickerOpen(false)}
                onAdd={addEffect}
              />
            )}

            {nodeEffects.length > 0 && (
              <div className="effectsList">
                {nodeEffects.map((effect) => (
                  <div
                    key={effect.id}
                    className="effectItem compact"
                    onClick={(e) => {
                      setActiveEffectEditorId(effect.id);
                      setActiveEffectEditorAnchor(
                        (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                      );
                    }}
                  >
                    <div className="effectItemHeader">
                      <div className="effectItemHeaderLeft">
                        <div className="effectGear">⚙</div>
                        <div className="effectItemTitle">{effectTitle(effect.type)}</div>
                      </div>

                      <div className="effectItemHeaderActions">
                        <button
                          type="button"
                          className="effectRemoveBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEffect(effect.id);
                            if (activeEffectEditorId === effect.id) {
                              setActiveEffectEditorId(null);
                            }
                            if (effectColorPickerId === effect.id) {
                              setEffectColorPickerId(null);
                            }
                          }}
                          title="Remove effect"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeEffect && (
              <EffectEditorPopover
                effect={activeEffect}
                anchorRect={activeEffectEditorAnchor}
                onClose={() => {
                  setActiveEffectEditorId(null);
                  setEffectColorPickerId(null);
                }}
                onPatch={(patch) => patchEffect(activeEffect.id, patch)}
                onOpenColor={(rect) => {
                  setEffectColorPickerId(activeEffect.id);
                  setEffectColorAnchorRect(rect);
                }}
              />
            )}

            {colorEffect &&
              (colorEffect.type === "drop-shadow" || colorEffect.type === "inner-shadow") && (
                <FillPopover
                  fillStyle={{
                    kind: "solid",
                    color: colorEffect.color,
                    alpha: colorEffect.alpha,
                  }}
                  anchorRect={effectColorAnchorRect}
                  onClose={() => setEffectColorPickerId(null)}
                  onChange={(next) => {
                    if (next.kind !== "solid") return;
                    patchEffect(colorEffect.id, {
                      color: next.color,
                      alpha: next.alpha,
                    } as any);
                  }}
                />
              )}
          </div>
        )}

        {!isArtboard && item.type === "ellipse" && (
          <>
            <div className="propsSectionTitle">Ellipse</div>
            <div className="propsGrid2">
              <RowInput
                label="Arc %"
                type="number"
                value={(item as any).arcPercent ?? 100}
                onChange={(value) =>
                  patchNode(item.id, {
                    arcPercent: clamp(
                      safeNumber(value, (item as any).arcPercent ?? 100),
                      1,
                      100
                    ),
                  } as any)
                }
              />
              <RowInput
                label="Arc deg"
                type="number"
                value={(item as any).arcRotation ?? 0}
                onChange={(value) =>
                  patchNode(item.id, {
                    arcRotation: safeNumber(value, (item as any).arcRotation ?? 0),
                  } as any)
                }
              />
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Hole %"
                type="number"
                value={(item as any).holePercent ?? 0}
                onChange={(value) =>
                  patchNode(item.id, {
                    holePercent: clamp(
                      safeNumber(value, (item as any).holePercent ?? 0),
                      0,
                      95
                    ),
                  } as any)
                }
              />
              <RowInput
                label="Offset %"
                type="number"
                value={(item as any).centerOffsetPercent ?? 0}
                onChange={(value) =>
                  patchNode(item.id, {
                    centerOffsetPercent: clamp(
                      safeNumber(value, (item as any).centerOffsetPercent ?? 0),
                      0,
                      80
                    ),
                  } as any)
                }
              />
            </div>
          </>
        )}

        {!isArtboard && item.type === "polygon" && (
          <>
            <div className="propsSectionTitle">Polygon</div>
            <RowInput
              label="Sides"
              type="number"
              value={(item as any).sides}
              onChange={(value) =>
                patchNode(item.id, {
                  sides: clamp(safeNumber(value, (item as any).sides), 3, 24),
                } as any)
              }
            />
          </>
        )}

        {!isArtboard && item.type === "star" && (
          <>
            <div className="propsSectionTitle">Star</div>
            <div className="propsGrid2">
              <RowInput
                label="Points"
                type="number"
                value={(item as any).points}
                onChange={(value) =>
                  patchNode(item.id, {
                    points: clamp(safeNumber(value, (item as any).points), 3, 40),
                  } as any)
                }
              />
              <RowInput
                label="Ratio %"
                type="number"
                value={(item as any).innerRatioPercent}
                onChange={(value) =>
                  patchNode(item.id, {
                    innerRatioPercent: clamp(
                      safeNumber(value, (item as any).innerRatioPercent),
                      10,
                      95
                    ),
                  } as any)
                }
              />
            </div>
          </>
        )}

        {!isArtboard && item.type === "image" && (
          <>
            <div className="propsSectionTitle">Image</div>
            <div className="propsTextBlock">
              <div className="propsTextLabel">Source</div>
              <input
                className="fillTextInput"
                value={(item as any).src}
                placeholder="Image URL"
                onChange={(e) => patchNode(item.id, { src: e.target.value } as any)}
              />
            </div>

            <div className="propsGrid2">
              <div className="propsRowInput">
                <div className="propsRowLabel">Fit</div>
                <select
                  className="propsInput"
                  value={(item as any).fit}
                  onChange={(e) => patchNode(item.id, { fit: e.target.value } as any)}
                >
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                  <option value="stretch">stretch</option>
                </select>
              </div>
            </div>
          </>
        )}

        {!isArtboard && item.type === "text" && (
          <>
            <div className="propsSectionTitle">Text</div>

            <div className="propsTextBlock">
              <div className="propsTextLabel">Content</div>
              <textarea
                className="propsTextarea"
                value={item.text ?? ""}
                onChange={(e) => patchNode(item.id, { text: e.target.value } as any)}
              />
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Font size"
                type="number"
                value={item.fontSize}
                onChange={(value) =>
                  patchNode(item.id, {
                    fontSize: clamp(safeNumber(value, item.fontSize), 8, 300),
                  } as any)
                }
              />

              <RowInput
                label="Weight"
                type="number"
                value={item.fontWeight ?? 400}
                onChange={(value) =>
                  patchNode(item.id, {
                    fontWeight: clamp(
                      safeNumber(value, item.fontWeight ?? 400),
                      100,
                      900
                    ),
                  } as any)
                }
              />
            </div>

            <div className="propsGrid2">
              <div className="propsRowInput">
                <div className="propsRowLabel">Font</div>
                <select
                  className="propsInput"
                  value={item.fontFamily}
                  onChange={(e) => patchNode(item.id, { fontFamily: e.target.value } as any)}
                >
                  <option value="Inter, Arial, sans-serif">Inter</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value='"Segoe UI", sans-serif'>Segoe UI</option>
                  <option value="Roboto, Arial, sans-serif">Roboto</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value='"Times New Roman", serif'>Times New Roman</option>
                  <option value='"Courier New", monospace'>Courier New</option>
                </select>
              </div>

              <div className="propsRowInput">
                <div className="propsRowLabel">Style</div>
                <select
                  className="propsInput"
                  value={item.fontStyle ?? "normal"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      fontStyle: e.target.value as "normal" | "italic",
                    } as any)
                  }
                >
                  <option value="normal">normal</option>
                  <option value="italic">italic</option>
                </select>
              </div>
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Text color"
                value={item.color}
                onChange={(value) => patchNode(item.id, { color: value } as any)}
              />

              <RowInput
                label="Box color"
                value={item.backgroundColor ?? "#ffffff"}
                onChange={(value) => patchNode(item.id, { backgroundColor: value } as any)}
              />
            </div>

            <div className="propsGrid2">
              <div className="propsRowInput">
                <div className="propsRowLabel">Align</div>
                <select
                  className="propsInput"
                  value={item.align}
                  onChange={(e) =>
                    patchNode(item.id, {
                      align: e.target.value as "left" | "center" | "right",
                    } as any)
                  }
                >
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </div>

              <div className="propsRowInput">
                <div className="propsRowLabel">Wrap</div>
                <select
                  className="propsInput"
                  value={item.wrap ?? "word"}
                  onChange={(e) =>
                    patchNode(item.id, {
                      wrap: e.target.value as "word" | "char" | "none",
                    } as any)
                  }
                >
                  <option value="word">word</option>
                  <option value="char">char</option>
                  <option value="none">none</option>
                </select>
              </div>
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Line height"
                type="number"
                value={item.lineHeight ?? 1.2}
                onChange={(value) =>
                  patchNode(item.id, {
                    lineHeight: clamp(
                      safeNumber(value, item.lineHeight ?? 1.2),
                      0.5,
                      4
                    ),
                  } as any)
                }
              />

              <RowInput
                label="Letter spacing"
                type="number"
                value={item.letterSpacing ?? 0}
                onChange={(value) =>
                  patchNode(item.id, {
                    letterSpacing: clamp(
                      safeNumber(value, item.letterSpacing ?? 0),
                      -10,
                      100
                    ),
                  } as any)
                }
              />
            </div>

            <div className="propsGrid2">
              <RowInput
                label="Padding"
                type="number"
                value={item.padding ?? 12}
                onChange={(value) =>
                  patchNode(item.id, {
                    padding: clamp(safeNumber(value, item.padding ?? 12), 0, 100),
                  } as any)
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}