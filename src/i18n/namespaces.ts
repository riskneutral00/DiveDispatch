export const NAMESPACES = [
  "app",
  "auth",
  "booking",
  "common",
  "errors",
  "medical",
  "nav",
  "portal",
  "waiver",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
