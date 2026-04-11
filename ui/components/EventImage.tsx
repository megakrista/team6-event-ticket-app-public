"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PLACEHOLDER_SRC = "/images/event-placeholder.svg";

type EventImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

function resolvedSrc(src: string | null | undefined): string {
  const t = src?.trim() ?? "";
  return t || PLACEHOLDER_SRC;
}

export default function EventImage({ src, alt, className }: EventImageProps) {
  const [imgSrc, setImgSrc] = useState(() => resolvedSrc(src));
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImgSrc(resolvedSrc(src));
  }, [src]);

  useEffect(() => {
    if (imgRef.current?.complete && !imgRef.current?.naturalWidth) {
      setImgSrc(PLACEHOLDER_SRC);
    }
  }, []);

  const showingUserImage = imgSrc !== PLACEHOLDER_SRC;

  const handleError = useCallback(() => {
    setImgSrc((current) =>
      current === PLACEHOLDER_SRC ? current : PLACEHOLDER_SRC,
    );
  }, []);

  return (
    <img
      ref={imgRef}
      src={imgSrc}
      alt={showingUserImage ? alt : ""}
      className={className}
      onError={handleError}
    />
  );
}
