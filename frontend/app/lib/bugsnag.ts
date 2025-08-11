import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";
import BugsnagPerformance from "@bugsnag/browser-performance";

// Only initialize Bugsnag in production builds
if (import.meta.env.PROD) {
	const apiKey =
		import.meta.env.VITE_BUGSNAG_API_KEY || "c82f1492acc354752a6feed861cd0bca";

	Bugsnag.start({
		apiKey: apiKey,
		plugins: [new BugsnagPluginReact()],
	});

	BugsnagPerformance.start({
		apiKey: apiKey,
	});
}

export const bugsnagClient = Bugsnag;
