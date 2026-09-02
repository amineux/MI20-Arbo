import { BrandVariants, Theme, createLightTheme } from "@fluentui/react-components";

/** Steel navy — work-tool look, no constructor branding. */
const steel: BrandVariants = {
  10: "#020305",
  20: "#111823",
  30: "#16263A",
  40: "#1B365D",
  50: "#244574",
  60: "#2D548B",
  70: "#3663A2",
  80: "#4A78B5",
  90: "#6B93C4",
  100: "#8BAED3",
  110: "#A7C3DF",
  120: "#C1D5E9",
  130: "#D6E4F1",
  140: "#E7F0F7",
  150: "#F3F7FB",
  160: "#F8FBFD",
};

export const mi20Theme: Theme = {
  ...createLightTheme(steel),
  colorBrandBackground: "#1B365D",
  colorBrandBackgroundHover: "#244574",
  colorBrandBackgroundPressed: "#16263A",
  colorBrandForeground1: "#1B365D",
  colorCompoundBrandForeground1: "#1B365D",
};
