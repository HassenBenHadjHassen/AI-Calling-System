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
			
			// Optimize dependencies
			commonjsOptions: {
				include: [/node_modules/],
			},
		},

		// Improve dev server performance
		server: {
			hmr: {
				overlay: false,
			},
		},
	};
});
