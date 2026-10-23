import { de } from './packs.de';
import { en } from './packs.en';

export type PackTopic = { title: string; short: string; keywords: string[]; answer: string };
export type Pack = {
  greeting: string; fallback: string; help: string; hedge: string; unknownCommand: string;
  menu: Record<string, string>;
  commandHints: Record<string, string>; commandAliases: Record<string, string>;
  /** Space-separated words that carry no meaning for matching (normalised). */
  stop: string;
  small: { greet: RegExp; thanks: RegExp; bye: RegExp; human: RegExp; feedback: RegExp };
  smallReplies: { thanks: string; bye: string; human: string; feedback: string };
  topics: Record<string, PackTopic>;
};
export const packs: { en: Pack; de: Pack } = { en, de };
