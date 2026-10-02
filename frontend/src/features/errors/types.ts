import type tr from "@/i18n/errors/tr.json";

export const ERROR_CODES = ["404", "403", "500", "503"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ErrorCopy = typeof tr;

export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
