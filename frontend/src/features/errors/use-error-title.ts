"use client";

import { useEffect } from "react";
import { useMessages } from "next-intl";
import { errorTitle, type ErrorCode, type ErrorCopy } from "./types";

/** Error boundaries are client components and cannot export metadata, so the tab title is set while the error shows. */
export function useErrorTitle(code: ErrorCode) {
  const copy = useMessages().errorPages as unknown as ErrorCopy;
  const title = `${errorTitle(code, copy[code].title)} · PDA`;
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}
