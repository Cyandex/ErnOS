import chalk, { Chalk } from "chalk";
import { SPROUT_PALETTE } from "./palette.js";

const hasForceColor =
  typeof process.env.FORCE_COLOR === "string" &&
  process.env.FORCE_COLOR.trim().length > 0 &&
  process.env.FORCE_COLOR.trim() !== "0";

const baseChalk = process.env.NO_COLOR && !hasForceColor ? new Chalk({ level: 0 }) : chalk;

const hex = (value: string) => baseChalk.hex(value);

export const theme = {
  accent: hex(SPROUT_PALETTE.accent),
  accentBright: hex(SPROUT_PALETTE.accentBright),
  accentDim: hex(SPROUT_PALETTE.accentDim),
  info: hex(SPROUT_PALETTE.info),
  success: hex(SPROUT_PALETTE.success),
  warn: hex(SPROUT_PALETTE.warn),
  error: hex(SPROUT_PALETTE.error),
  muted: hex(SPROUT_PALETTE.muted),
  heading: baseChalk.bold.hex(SPROUT_PALETTE.accent),
  command: hex(SPROUT_PALETTE.accentBright),
  option: hex(SPROUT_PALETTE.warn),
} as const;

export const isRich = () => Boolean(baseChalk.level > 0);

export const colorize = (rich: boolean, color: (value: string) => string, value: string) =>
  rich ? color(value) : value;
