import type tr from "@/i18n/errors/tr.json";

export const ERROR_CODES = ["404", "403", "500", "503"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ErrorCopy = typeof tr;

/** Tab title for an error screen: the code plus its heading without the closing full stop. */
export function errorTitle(code: ErrorCode, heading: string) {
  return `${code} · ${heading.replace(/[.!?…]+$/, "")}`;
}

export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
