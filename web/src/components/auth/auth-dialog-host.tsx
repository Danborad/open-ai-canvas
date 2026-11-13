import { Component, lazy, Suspense, useEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Button, Spin } from "antd";
import { RefreshCw, TriangleAlert, X } from "lucide-react";

import { useAuthDialogStore } from "@/stores/use-auth-dialog-store";

type AuthDialogProps = { navigate: (to: string) => void };

function createLazyAuthDialog() {
    return lazy<ComponentType<AuthDialogProps>>(() => import("./auth-dialog"));
}

type ErrorBoundaryProps = {
    resetKey: number;
    open: boolean;
    onRetry: () => void;
    onClose: () => void;
    children: ReactNode;
};

type ErrorBoundaryState = { hasError: boolean };

class AuthDialogErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.warn("登录弹窗加载失败，已隔离错误避免整页卸载", error, info);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        if (!this.props.open) return null;
        return (
            <div role="dialog" aria-modal="true" aria-label="登录窗口加载失败" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-xs">
                <div className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center text-foreground shadow-lg">
                    <button
                        type="button"
                        aria-label="关闭"
                        onClick={this.props.onClose}
                        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                    <TriangleAlert className="size-8 text-amber-500" aria-hidden="true" />
                    <div className="space-y-1">
                        <h3 className="text-base font-medium">登录窗口加载失败</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">网络波动导致部分登录资源未能加载，请重试。</p>
                    </div>
                    <div className="flex w-full gap-2 pt-1">
                        <Button block onClick={this.props.onClose}>
                            取消
                        </Button>
                        <Button type="primary" block icon={<RefreshCw className="size-3.5" />} onClick={this.props.onRetry}>
                            重试
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}

/**
 * 全局登录弹窗挂载点，放在 RouterProvider 旁边，分享页等路由外层页面也能打开。
 * 首次打开前不加载表单代码；内部带有错误边界与重建机制，避免资源加载失败导致整页崩溃。
 */
export function AuthDialogHost({ navigate }: { navigate: (to: string) => void }) {
    const open = useAuthDialogStore((state) => state.open);
    const closeDialog = useAuthDialogStore((state) => state.closeDialog);
    const [requested, setRequested] = useState(open);
    const [attempt, setAttempt] = useState(0);
    const [dialogEntry, setDialogEntry] = useState(() => ({ Component: createLazyAuthDialog() }));

    useEffect(() => {
        if (open) setRequested(true);
    }, [open]);

    if (!requested) return null;

    const retry = () => {
        // React.lazy 会缓存失败的 Promise，必须重建 lazy 包装器才能真正重新拉取模块。
        setDialogEntry({ Component: createLazyAuthDialog() });
        setAttempt((value) => value + 1);
    };

    const DialogComponent = dialogEntry.Component;

    const loadingFallback = open ? (
        <div role="status" aria-live="polite" aria-label="正在打开登录窗口" className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-xs">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3.5 text-sm text-foreground shadow-lg">
                <Spin size="small" />
                <span>正在打开登录窗口…</span>
            </div>
        </div>
    ) : null;

    return (
        <AuthDialogErrorBoundary
            resetKey={attempt}
            open={open}
            onRetry={retry}
            onClose={() => {
                closeDialog();
                retry();
            }}
        >
            <Suspense fallback={loadingFallback}>
                <DialogComponent navigate={navigate} />
            </Suspense>
        </AuthDialogErrorBoundary>
    );
}
