"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";

type ToastType = "success" | "error";

type ToastItem = {
    id: number;
    type: ToastType;
    message: string;
};

type ToastContextValue = {
    success: (message: string) => void;
    error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function extractErrorMessage(
    error: unknown,
    fallback = "Something went wrong."
) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error.trim().length > 0) return error;
    return fallback;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idRef = useRef(1);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback((type: ToastType, message: string) => {
        const id = idRef.current++;
        setToasts((prev) => [...prev, { id, type, message }]);
        window.setTimeout(() => removeToast(id), 3600);
    }, [removeToast]);

    const value = useMemo<ToastContextValue>(
        () => ({
            success: (message) => push("success", message),
            error: (message) => push("error", message),
        }),
        [push]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed right-4 top-4 z-[120] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
                {toasts.map((toast) => {
                    const colorClasses =
                        toast.type === "success"
                            ? "border-emerald-400/20"
                            : "border-red-400/20";
                    const iconClasses =
                        toast.type === "success"
                            ? "bg-emerald-400/15 text-emerald-200"
                            : "bg-red-400/15 text-red-200";

                    return (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto w-fit max-w-[min(360px,calc(100vw-2rem))] rounded-lg border bg-[#111824]/95 px-3.5 py-2.5 text-[13px] text-white/85 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm ${colorClasses}`}
                            role="status"
                            aria-live="polite"
                        >
                            <div className="flex items-start gap-2.5">
                                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${iconClasses}`}>
                                    {toast.type === "success" ? (
                                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                            <path d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.263a1 1 0 0 1-1.42.006L3.29 9.25a1 1 0 0 1 1.42-1.408l4.092 4.138 6.487-6.543a1 1 0 0 1 1.415-.147Z" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                            <path d="M10 6.5v4.5" />
                                            <circle cx="10" cy="14.2" r="0.7" fill="currentColor" stroke="none" />
                                            <path d="M10 2.8 17 15a1 1 0 0 1-.87 1.5H3.87A1 1 0 0 1 3 15l7-12.2Z" />
                                        </svg>
                                    )}
                                </span>
                                <p className="leading-5">{toast.message}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}
