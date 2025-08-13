import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	// Load env file based on `mode` in the current working directory.
	const env = loadEnv(mode, process.cwd(), "");

	return {
		plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
		define: {
			__APP_ENV__: JSON.stringify(env.APP_ENV),
		},
		build: {
			// Enable source maps for debugging
			sourcemap: mode === "development",
			// Optimize chunk size
			rollupOptions: {
				output: {
					manualChunks: {
						// Separate vendor chunks for better caching
						vendor: ["react", "react-dom"],
						ui: [
							"lucide-react",
							"@radix-ui/react-dialog",
							"@radix-ui/react-dropdown-menu",
						],
						utils: ["clsx", "class-variance-authority", "tailwind-merge"],
						i18n: ["i18next", "react-i18next"],
					},
				},
			},
			// Optimize dependencies
			commonjsOptions: {
				include: [/node_modules/],
			},
		},
		optimizeDeps: {
			// Pre-bundle dependencies for faster dev server
			include: [
				"react",
				"react-dom",
				"lucide-react",
				"@radix-ui/react-dialog",
				"@radix-ui/react-dropdown-menu",
				"clsx",
				"class-variance-authority",
				"tailwind-merge",
				"i18next",
				"react-i18next",
			],
		},
		// Improve dev server performance
		server: {
			hmr: {
				overlay: false,
			},
		},
	};
});
