export const LOGO_SHAPES = ["SQUARE", "CIRCLE"] as const;
export type LogoShape = (typeof LOGO_SHAPES)[number];
