"use client";

import { useClientSideAuth } from "~/hooks/use-auth";
import { useEffect } from "react";

export default function Home() {
	const { isClient, redirectIfAuthenticated, redirectIfNotAuthenticated } =
		useClientSideAuth();

	useEffect(() => {
		if (isClient) {
			redirectIfAuthenticated("/dashboard");
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfAuthenticated, redirectIfNotAuthenticated]);

	// Show loading state during SSR
	if (!isClient) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	// This should never render on client, but just in case
	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
		</div>
	);
}
