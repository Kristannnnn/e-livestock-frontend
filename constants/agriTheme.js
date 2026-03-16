import { MD3LightTheme } from "react-native-paper";

export const agriPalette = {
  ink: "#203126",
  inkSoft: "#586658",
  fieldDeep: "#1F4D2E",
  field: "#2F6B3D",
  meadow: "#5A8F51",
  leaf: "#8EAD67",
  wheat: "#D2A64A",
  wheatLight: "#F0D48E",
  cream: "#F7F1E5",
  surface: "#FFFDF7",
  surfaceMuted: "#F1E8D8",
  mist: "#E5ECD7",
  border: "#D0D8C1",
  redClay: "#BC5D3E",
  sky: "#89AD9D",
  white: "#FFFFFF",
};

export const gradientSets = {
  primary: [agriPalette.fieldDeep, agriPalette.field],
  meadow: [agriPalette.field, "#6AA05B"],
  wheat: [agriPalette.wheat, "#E1BF6B"],
  earth: ["#835331", "#B77845"],
  sky: ["#5A8576", "#86AE95"],
  muted: ["#EEF3E2", "#DCE8C3"],
  danger: [agriPalette.redClay, "#D7845E"],
};

export const statAccents = {
  meadow: ["#EEF7E9", "#D8EBC9"],
  wheat: ["#FFF4D6", "#F2DC9F"],
  clay: ["#F7E1D5", "#E6B9A0"],
  sky: ["#E4F1EB", "#C7DDD1"],
};

export const agriPaperTheme = {
  ...MD3LightTheme,
  roundness: 7,
  colors: {
    ...MD3LightTheme.colors,
    primary: agriPalette.field,
    onPrimary: agriPalette.white,
    secondary: agriPalette.wheat,
    onSecondary: agriPalette.fieldDeep,
    tertiary: agriPalette.sky,
    background: agriPalette.cream,
    surface: agriPalette.surface,
    surfaceVariant: agriPalette.surfaceMuted,
    onSurface: agriPalette.ink,
    onSurfaceVariant: agriPalette.inkSoft,
    outline: agriPalette.border,
    outlineVariant: "#E4E8DA",
    error: agriPalette.redClay,
  },
};
