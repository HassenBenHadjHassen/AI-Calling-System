import * as React from "react";
import { createContext, useContext, useState } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface Toast {
	id: string;
	message: string;
	type: "success" | "error" | "info";
}

interface ToastContextType {
	toasts: Toast[];
	addToast: (message: string, type: Toast["type"]) => void;
	removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = (message: string, type: Toast["type"]) => {
		const id = Math.random().toString(36).substr(2, 9);
		const newToast: Toast = { id, message, type };
		setToasts((prev) => [...prev, newToast]);

		// Auto remove after 3 seconds
		setTimeout(() => {
			removeToast(id);
		}, 3000);
	};

	const removeToast = (id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	};

	return (
		<ToastContext.Provider value={{ toasts, addToast, removeToast }}>
			{children}
			<ToastContainer />
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}

function ToastContainer() {
	const { toasts, removeToast } = useToast();

	return (
		<div className="fixed top-4 right-4 z-50 space-y-2">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={cn(
						"flex items-center justify-between p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300",
						{
							"bg-green-500 text-white": toast.type === "success",
							"bg-red-500 text-white": toast.type === "error",
							"bg-blue-500 text-white": toast.type === "info",
						}
					)}
				>
					<span className="text-sm font-medium">{toast.message}</span>
					<button
						onClick={() => removeToast(toast.id)}
						className="ml-4 text-white hover:text-gray-200 transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			))}
		</div>
	);
}
