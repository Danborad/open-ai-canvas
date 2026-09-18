import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

import { resolveResourceUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import { cacheResourceObjectUrl, peekCachedResourceObjectUrl } from "@/services/resource-blob-cache";
import { resolveImageUrl } from "@/services/image-storage";

type CachedResourceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    storageKey?: string;
    src?: string;
    fallback?: ReactNode;
    loadingFallback?: ReactNode;
    eager?: boolean;
};

/**
 * 资源图片优先使用浏览器原生 HTTP 30 天磁盘强缓存，直接以有效 URL 首屏秒开；
 * 同时自动读取按用户隔离的本地 Blob 缓存，离线或跨会话时无缝兜底。
 */
export function CachedResourceImage({ storageKey, src = "", fallback = null, loadingFallback = fallback, eager = false, onError, ...props }: CachedResourceImageProps) {
    const remoteResource = Boolean(resourceIdFromStorageKey(storageKey));
    const localImageResource = Boolean(storageKey && storageKey.startsWith("image:"));
    const targetRef = useRef<HTMLSpanElement>(null);
    const [nearViewport, setNearViewport] = useState(eager || !remoteResource);
    const synchronousUrl = remoteResource && storageKey ? peekCachedResourceObjectUrl(storageKey) : "";
    const directUrl = remoteResource && storageKey ? resolveResourceUrl(storageKey, src) : src;
    const [cachedSrc, setCachedSrc] = useState(synchronousUrl || directUrl);
    const [cacheFailed, setCacheFailed] = useState(false);

    useEffect(() => {
        if (!remoteResource || eager) {
            setNearViewport(true);
            return;
        }
        const image = targetRef.current;
        if (!image || typeof IntersectionObserver === "undefined") {
            setNearViewport(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "240px" },
        );
        observer.observe(image);
        return () => observer.disconnect();
    }, [eager, remoteResource]);

    useEffect(() => {
        let cancelled = false;
        setCacheFailed(false);

        if (remoteResource && storageKey) {
            const fallbackSrc = resolveResourceUrl(storageKey, src);
            if (!nearViewport) {
                setCachedSrc(fallbackSrc);
                return () => {
                    cancelled = true;
                };
            }
            const sync = peekCachedResourceObjectUrl(storageKey);
            if (sync) {
                setCachedSrc(sync);
                return () => {
                    cancelled = true;
                };
            }
            if (!cachedSrc) setCachedSrc(fallbackSrc);
            const resolve = cacheResourceObjectUrl(storageKey);
            void resolve
                .then((url) => {
                    if (!cancelled && url) setCachedSrc(url);
                })
                .catch(() => {
                    if (!cancelled) {
                        setCacheFailed(true);
                        setCachedSrc(fallbackSrc);
                    }
                });
            return () => {
                cancelled = true;
            };
        }

        if (localImageResource && storageKey) {
            void resolveImageUrl(storageKey, src)
                .then((url) => {
                    if (!cancelled) setCachedSrc(url || src);
                })
                .catch(() => {
                    if (!cancelled) setCachedSrc(src);
                });
            return () => {
                cancelled = true;
            };
        }

        setCachedSrc(src);
        return () => {
            cancelled = true;
        };
    }, [localImageResource, nearViewport, remoteResource, src, storageKey]);

    const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        if (localImageResource && storageKey && cachedSrc.startsWith("blob:")) {
            void resolveImageUrl(storageKey)
                .then((url) => {
                    if (url && url !== cachedSrc) {
                        setCachedSrc(url);
                        return;
                    }
                    setCacheFailed(true);
                    onError?.(e);
                })
                .catch(() => {
                    setCacheFailed(true);
                    onError?.(e);
                });
            return;
        }
        if (remoteResource && storageKey && cachedSrc.startsWith("blob:")) {
            // Blob URL 失效时自动回退至直连 URL，避免黑屏
            const fallbackUrl = resolveResourceUrl(storageKey, src);
            if (fallbackUrl && fallbackUrl !== cachedSrc) {
                setCachedSrc(fallbackUrl);
                return;
            }
        }
        setCacheFailed(true);
        onError?.(e);
    };

    return (
        <span ref={targetRef} className="cached-resource-image-shell inline-flex min-h-0 min-w-0">
            {cachedSrc && !cacheFailed ? <img alt={props.alt || ""} {...props} src={cachedSrc} onError={handleImgError} /> : cacheFailed ? fallback : loadingFallback}
        </span>
    );
}
