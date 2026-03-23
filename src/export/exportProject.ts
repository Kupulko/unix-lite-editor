import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Scene, SceneNode, RectNode, TextNode } from "../types";

function indent(s: string, spaces = 2) {
  const pad = " ".repeat(spaces);
  return s
    .split("\n")
    .map((l) => (l.length ? pad + l : l))
    .join("\n");
}

function nodeToJSX(node: SceneNode) {
  const baseStyle: Record<string, string | number> = {
    position: "absolute",
    left: `${Math.round(node.x)}px`,
    top: `${Math.round(node.y)}px`,
    width: `${Math.round(node.width)}px`,
    height: `${Math.round(node.height)}px`,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : "none",
    opacity: node.opacity ?? 1,
  };

  if (node.type === "rect") {
    const n = node as RectNode;
    const style = {
      ...baseStyle,
      background: n.fill,
      border: `${n.strokeWidth}px solid ${n.stroke}`,
      borderRadius: `${n.cornerRadius}px`,
    };
    return `<div style={${JSON.stringify(style)}} />`;
  }

  const t = node as TextNode;
  const style = {
    ...baseStyle,
    color: t.color,
    fontSize: `${t.fontSize}px`,
    fontFamily: t.fontFamily,
    fontStyle: t.fontStyle === "italic" ? "italic" : "normal",
    fontWeight: t.fontStyle === "bold" ? 700 : 400,
    textAlign: t.align,
    display: "flex",
    alignItems: "center",
    justifyContent: t.align === "left" ? "flex-start" : t.align === "right" ? "flex-end" : "center",
    padding: "2px 6px",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  };
  const text = t.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style={${JSON.stringify(style)}}>${text}</div>`;
}

function makeAppTsx(scene: Scene) {
  const nodesJsx = scene.nodes.map(nodeToJSX).join("\n");
  const frameStyle = {
    position: "relative",
    width: `${scene.frame.width}px`,
    height: `${scene.frame.height}px`,
    background: scene.frame.background,
    borderRadius: "18px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 18px 45px rgba(0,0,0,.35)",
  };

  return `import React from "react";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0f14", padding: 24 }}>
      <div style={${JSON.stringify(frameStyle)}}>
${indent(nodesJsx, 8)}
      </div>
    </div>
  );
}
`;
}

function makeViteReactFiles(appTsx: string) {
  const pkg = {
    name: "exported-design",
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
    devDependencies: {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      typescript: "^5.5.4",
      vite: "^5.4.2",
    },
  };

  const files: Record<string, string> = {
    "package.json": JSON.stringify(pkg, null, 2),
    "vite.config.ts": `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n`,
    "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
`,
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Exported Design</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    "src/App.tsx": appTsx,
  };

  return files;
}

export async function exportSceneAsViteReactZip(scene: Scene) {
  const zip = new JSZip();
  const files = makeViteReactFiles(makeAppTsx(scene));

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  saveAs(blob, `exported-design-${ts}.zip`);
}