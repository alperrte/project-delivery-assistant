import { ApiError } from "./client";

/** Maps an API failure to a key under the `errors` i18n namespace. */
export function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return "generic";
  if (err.isNetwork) return "network";
  switch (err.status) {
    case 400:
      return "invalidFields";
    case 401:
      return "invalidCredentials";
    case 403:
      return "forbidden";
    case 409:
      return "conflict";
    case 429:
      return "tooManyRequests";
    default:
      return "generic";
  }
}
