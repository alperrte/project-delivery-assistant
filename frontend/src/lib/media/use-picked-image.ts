"use client";
import { useEffect, useRef, useState } from "react";
export function usePickedImage() {
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const urlRef = useRef<string | null>(null);
  function change(file: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = file ? URL.createObjectURL(file) : null;
    setPicked(file && urlRef.current ? { file, url: urlRef.current } : null);
  }
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  return { file: picked?.file ?? null, url: picked?.url ?? null, change };
}
