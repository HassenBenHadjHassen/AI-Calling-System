#!/usr/bin/env ts-node

import { callStatusPoller } from "../src/services/callStatusPoller";

// Parse command line arguments
const args = process.argv.slice(2);
const usage = `
Usage: npm run polStatus <vapiCallId> <dbCallId> [options]

Arguments:
  vapiCallId    The Vapi.ai call ID to poll
  dbCallId      The database call ID

Options:
  --help, -h    Show this help message
  --duration    Set custom polling duration in minutes (default: 15)
  --interval    Set custom polling interval in seconds (default: 5)
  --stop        Stop polling for the specified call
  --stats       Show current polling statistics
  --stop-all    Stop all active polling

Examples:
  npm run polStatus vapi_call_123 db_call_456
  npm run polStatus vapi_call_123 db_call_456 --duration 30 --interval 10
  npm run polStatus vapi_call_123 --stop
  npm run polStatus --stats
  npm run polStatus --stop-all
`;

function showHelp() {
	console.log(usage);
	process.exit(0);
}

function showStats() {
	const stats = callStatusPoller.getPollingStats();
	console.log("\n📊 Polling Statistics:");
	console.log(`Active Pollers: ${stats.activePollers}`);
	console.log("\nConfiguration:");
	console.log(`  Active Call Interval: ${stats.config.activeCallInterval}ms`);
	console.log(`  Stale Call Interval: ${stats.config.staleCallInterval}ms`);
	console.log(`  Max Polling Duration: ${stats.config.maxPollingDuration}ms`);
	console.log(`  Retry Attempts: ${stats.config.retryAttempts}`);
	console.log(`  Retry Delay: ${stats.config.retryDelay}ms`);
	console.log(`  Batch Size: ${stats.config.batchSize}`);
	console.log(`  Lookback Minutes: ${stats.config.lookbackMinutes}`);
}

async function main() {
	try {
		// Check for help flag
		if (args.includes("--help") || args.includes("-h")) {
			showHelp();
		}

		// Check for stats flag
		if (args.includes("--stats")) {
			showStats();
			return;
		}

		// Check for stop-all flag
		if (args.includes("--stop-all")) {
			console.log("🛑 Stopping all active polling...");
			callStatusPoller.stopAllPolling();
			return;
		}

		// Check for stop flag
		if (args.includes("--stop")) {
			const vapiCallId = args[args.indexOf("--stop") - 1];
			if (!vapiCallId) {
				console.error("❌ Error: vapiCallId is required when using --stop");
				showHelp();
				return;
			}
			console.log(`🛑 Stopping polling for ${vapiCallId}...`);
			callStatusPoller.stopPolling(vapiCallId);
			return;
		}

		// Get required arguments
		const [vapiCallId, dbCallId] = args;

		if (!vapiCallId || !dbCallId) {
			console.error("❌ Error: vapiCallId and dbCallId are required");
			showHelp();
			return;
		}

		// Parse optional arguments
		const durationIndex = args.indexOf("--duration");
		const intervalIndex = args.indexOf("--interval");

		let customDuration: number | undefined;
		let customInterval: number | undefined;

		if (durationIndex !== -1 && args[durationIndex + 1]) {
			customDuration = parseInt(args[durationIndex + 1]) * 60 * 1000; // Convert to milliseconds
		}

		if (intervalIndex !== -1 && args[intervalIndex + 1]) {
			customInterval = parseInt(args[intervalIndex + 1]) * 1000; // Convert to milliseconds
		}

		console.log("🚀 Starting individual call polling...");
		console.log(`📞 Vapi Call ID: ${vapiCallId}`);
		console.log(`🗄️  Database Call ID: ${dbCallId}`);

		if (customDuration) {
			console.log(`⏱️  Custom Duration: ${customDuration / 1000 / 60} minutes`);
		}
		if (customInterval) {
			console.log(`🔄 Custom Interval: ${customInterval / 1000} seconds`);
		}

		// Start polling
		callStatusPoller.startPolling(vapiCallId, dbCallId);

		// Set up graceful shutdown
		const cleanup = () => {
			console.log("\n🛑 Shutting down...");
			callStatusPoller.stopPolling(vapiCallId);
			process.exit(0);
		};

		process.on("SIGINT", cleanup);
		process.on("SIGTERM", cleanup);

		// Keep the process running
		console.log("\n📡 Polling started. Press Ctrl+C to stop...");

		// Show initial stats
		setTimeout(() => {
			showStats();
		}, 2000);
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}

// Run the script
if (require.main === module) {
	main();
}
