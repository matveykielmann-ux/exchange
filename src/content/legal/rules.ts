import { excerpt, parseMarkdown, type MdBlock, type MdExcerpt } from './markdown';
import { SERVICE_RULES } from './terms';

let parsed: MdBlock[] | null = null;

/** The Service Rules, parsed once. */
export function serviceRulesBlocks(): MdBlock[] {
  return (parsed ??= parseMarkdown(SERVICE_RULES.markdown ?? ''));
}

/** A clause ("4.11") or section ("6") of the Service Rules, word for word. Throws if it does not exist. */
export function rulesExcerpt(ref: string): MdExcerpt {
  return excerpt(serviceRulesBlocks(), ref);
}
