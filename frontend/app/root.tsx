import React from "react";
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Route } from "./+types/root";
import "./app.css";
import { queryClient } from "./lib/query-client";
import "./lib/i18n";
import { ToastProvider } from "./components/ui/toast";
import { bugsnagClient } from "./lib/bugsnag";
import { useTranslation } from "react-i18next";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

function DynamicLangAttribute() {
	const { i18n } = useTranslation();

	// Update document lang attribute when language changes
	React.useEffect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.lang = i18n.language;
		}
	}, [i18n.language]);

	return null;
}

export function Layout({ children }: { children: React.ReactNode }) {
	// Create Bugsnag Error Boundary only in production
	const ErrorBoundary = import.meta.env.PROD
		? bugsnagClient.getPlugin("react")?.createErrorBoundary(React) ||
		  (({ children }: { children: React.ReactNode }) => <>{children}</>)
		: ({ children }: { children: React.ReactNode }) => <>{children}</>;

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<ErrorBoundary>
						<ToastProvider>
							<DynamicLangAttribute />
							{children}
						</ToastProvider>
					</ErrorBoundary>
				</QueryClientProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
