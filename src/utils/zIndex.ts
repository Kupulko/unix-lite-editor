import { SceneNode } from "../types";

export function bringToFront(nodes: SceneNode[], id: string) {
  const i = nodes.findIndex(n => n.id === id);
  if (i === -1) return nodes;

  const node = nodes[i];
  const copy = [...nodes];

  copy.splice(i, 1);
  copy.push(node);

  return copy;
}

export function sendToBack(nodes: SceneNode[], id: string) {
  const i = nodes.findIndex(n => n.id === id);
  if (i === -1) return nodes;

  const node = nodes[i];
  const copy = [...nodes];

  copy.splice(i, 1);
  copy.unshift(node);

  return copy;
}

export function bringForward(nodes: SceneNode[], id: string) {
  const i = nodes.findIndex(n => n.id === id);
  if (i === -1 || i === nodes.length - 1) return nodes;

  const copy = [...nodes];
  [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];

  return copy;
}

export function sendBackward(nodes: SceneNode[], id: string) {
  const i = nodes.findIndex(n => n.id === id);
  if (i <= 0) return nodes;

  const copy = [...nodes];
  [copy[i], copy[i - 1]] = [copy[i - 1], copy[i]];

  return copy;
}