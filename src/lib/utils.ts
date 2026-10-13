// shadcn's `cn` package (clsx + tailwind-merge in one). New shadcn items import it directly;
// this re-export keeps `@/lib/utils` working for registries that still use the alias (React Bits, SpaceUI).
export { cn, type ClassValue } from 'cn';
