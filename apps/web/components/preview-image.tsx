"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Remote preview images are arbitrary third-party URLs. We deliberately use a
 * plain <img> (no Next image proxy) and fall back locally when the host blocks
 * hotlinking or the URL is invalid.
 */
export function PreviewImage({
  src,
  alt = "",
  className,
  fallback,
}: {
  src: string;
  alt?: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote OG image, no proxy
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
