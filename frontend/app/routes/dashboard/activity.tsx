"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
	Clock,
	CheckCircle,
	XCircle,
	ArrowRight,
	Download,
	RefreshCw,
	AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { formatPhoneNumber, formatDate } from "~/lib/utils";
import { socketService } from "~/lib/socket";
import { callAPI, type CallHistory } from "~/services/api";
import { useQueryClient } from "@tanstack/react-query";

interface ActivityItem {
	id: string;
	phone: string;
	status: string;
	lead: string;
	timestamp: string;
	duration?: number;
	notes?: string;
	campaignId?: string;
	campaignName?: string;
}

const statusIcons = {
	INITIATED: Clock,
	COMPLETED: CheckCircle,
	TRANSFERRED: ArrowRight,
	FAILED: XCircle,
};

const statusColors = {
	INITIATED: "info",
	COMPLETED: "success",
	TRANSFERRED: "warning",
	FAILED: "destructive",
};

export default function ActivityPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const [activities, setActivities] = useState<ActivityItem[]>([]);
	const [isDownloading, setIsDownloading] = useState(false);
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	// Function to translate status
	const translateStatus = (status: string) => {
		switch (status) {
			case "INITIATED":
				return t("activity.initiated");
			case "COMPLETED":
				return t("activity.completed");
			case "TRANSFERRED":
				return t("activity.transferred");
			case "FAILED":
				return t("activity.failed");
			case "SCHEDULED":
				return t("activity.scheduled");
			default:
				return status;
		}
	};

	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	// Fetch real call history data
	const { data: callHistoryData, isLoading: statsLoading } = useQuery({
		queryKey: ["call-history"],
		queryFn: () => callAPI.getCallStats(),
		enabled: isAuthenticated,
		refetchInterval: 10000, // Refresh every 10 seconds
	});

	// Fetch recent call activities
	const { data: recentCallsData, isLoading: callsLoading } = useQuery({
		queryKey: ["recent-calls"],
		queryFn: () => callAPI.getRecentCalls(50),
		enabled: isAuthenticated,
		refetchInterval: 10000, // Refresh every 10 seconds
	});

	// Fetch call management statistics
	const { data: callManagementData, isLoading: managementLoading } = useQuery({
		queryKey: ["call-management-stats"],
		queryFn: () => callAPI.getCallManagementStats(),
		enabled: isAuthenticated,
		refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
	});

	useEffect(() => {
		if (isAuthenticated && isClient) {
			// Connect to socket when dashboard loads
			socketService.connect();

			const socket = socketService.getSocket();
			if (socket) {
				// Listen for real-time call status updates
				socket.on("call-status-updated", (data) => {
					console.log("Call status updated:", data);
					// Invalidate queries to refresh data
					queryClient.invalidateQueries({ queryKey: ["call-history"] });
					queryClient.invalidateQueries({ queryKey: ["recent-calls"] });
				});

				// Listen for real-time activity updates
				socket.on("call-activity", (activity: ActivityItem) => {
					setActivities((prev) => [activity, ...prev.slice(0, 49)]); // Keep last 50 items
				});

				// Listen for mock activity (for demo)
				socket.on("mock-activity", (activity: ActivityItem) => {
					setActivities((prev) => [activity, ...prev.slice(0, 49)]);
				});
			}

			return () => {
				if (socket) {
					socket.off("call-status-updated");
					socket.off("call-activity");
					socket.off("mock-activity");
				}
				socketService.disconnect();
			};
		}
	}, [isAuthenticated, isClient, queryClient]);

	// Transform real call data into activity format
	useEffect(() => {
		if (recentCallsData?.data) {
			const transformedActivities: ActivityItem[] = recentCallsData.data.map(
				(call) => ({
					id: call.id,
					phone: call.lead?.phone1 || "",
					status: call.callStatus,
					lead: call.lead?.name || "Unknown Lead",
					timestamp: call.callTime,
					duration: call.duration,
					notes: call.notes,
					campaignId: call.lead?.campaign?.id,
					campaignName: call.lead?.campaign?.name,
				})
			);
			setActivities(transformedActivities);
		}
	}, [recentCallsData]);

	// Download activity data as CSV
	const downloadActivityData = async () => {
		setIsDownloading(true);
		try {
			// Fetch more data for download (e.g., last 1000 calls)
			const response = await callAPI.getRecentCalls(1000);
			if (response.success && response.data) {
				const csvData = [
					// CSV header with translated titles based on current language
					[
						t("activity.leadName"),
						t("activity.phone"),
						t("activity.status"),
						t("activity.callTime"),
						t("activity.durationSeconds"),
						t("activity.campaign"),
						"Campaign ID", // Keep ID in English as it's a technical field
						t("activity.notes"),
					].join(","),
					// CSV rows
					...response.data.map((call) =>
						[
							`"${call.lead?.name || t("activity.unknownLead")}"`,
							`"${call.lead?.phone1 || ""}"`,
							`"${call.callStatus}"`,
							`"${formatDate(call.callTime)}"`,
							call.duration || 0,
							`"${call.lead?.campaign?.name || ""}"`,
							`"${call.lead?.campaign?.id || ""}"`,
							`"${call.notes || ""}"`,
						].join(",")
					),
				].join("\n");

				// Create and download file with proper UTF-8 encoding
				const BOM = "\uFEFF"; // UTF-8 BOM
				const csvDataWithBOM = BOM + csvData;
				const blob = new Blob([csvDataWithBOM], {
					type: "text/csv;charset=utf-8",
				});
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `activity-data-${
					new Date().toISOString().split("T")[0]
				}.csv`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
			}
		} catch (error) {
			console.error("Failed to download activity data:", error);
		} finally {
			setIsDownloading(false);
		}
	};

	// Show loading state during SSR
	if (!isClient) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	// Don't render if not authenticated
	if (!isAuthenticated) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 p-6">
					<div className="space-y-8">
						<div className="text-center">
							<h1 className="text-3xl font-bold text-gray-900 mb-2">
								{t("activity.liveActivityFeed")}
							</h1>
							<p className="text-gray-600 text-lg mb-4">
								{t("activity.realTimeUpdates")}
							</p>
							<Button
								onClick={downloadActivityData}
								disabled={isDownloading}
								className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
							>
								<Download className="h-4 w-4" />
								<span>
									{isDownloading
										? t("activity.downloading")
										: t("activity.downloadActivity")}
								</span>
							</Button>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-blue-500 rounded-xl group-hover:bg-blue-600 transition-colors duration-300">
												<Clock className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-blue-700 mb-1">
													{t("activity.activeCalls")}
												</p>
												<p className="text-3xl font-bold text-blue-900">
													{statsLoading
														? "..."
														: callManagementData?.data?.activeCalls ||
														  callHistoryData?.data?.initiatedCalls ||
														  0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-green-500 rounded-xl group-hover:bg-green-600 transition-colors duration-300">
												<CheckCircle className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-green-700 mb-1">
													{t("activity.completedCalls")}
												</p>
												<p className="text-3xl font-bold text-green-900">
													{statsLoading
														? "..."
														: callHistoryData?.data?.completedCalls ||
														  callHistoryData?.data?.completed ||
														  0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-orange-500 rounded-xl group-hover:bg-orange-600 transition-colors duration-300">
												<ArrowRight className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-orange-700 mb-1">
													{t("activity.transferredCalls")}
												</p>
												<p className="text-3xl font-bold text-orange-900">
													{statsLoading
														? "..."
														: callHistoryData?.data?.transferredCalls ||
														  callHistoryData?.data?.transferred ||
														  0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-red-500 rounded-xl group-hover:bg-red-600 transition-colors duration-300">
												<XCircle className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-red-700 mb-1">
													{t("activity.failedCalls")}
												</p>
												<p className="text-3xl font-bold text-red-900">
													{statsLoading
														? "..."
														: callHistoryData?.data?.failedCalls ||
														  callHistoryData?.data?.failed ||
														  0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Call Management Queue Stats */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-purple-500 rounded-xl group-hover:bg-purple-600 transition-colors duration-300">
												<Clock className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-purple-700 mb-1">
													{t("activity.callQueue")}
												</p>
												<p className="text-3xl font-bold text-purple-900">
													{managementLoading
														? "..."
														: callManagementData?.data?.queueLength || 0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-orange-500 rounded-xl group-hover:bg-orange-600 transition-colors duration-300">
												<Clock className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-orange-700 mb-1">
													{t("activity.scheduledInQueue")}
												</p>
												<p className="text-3xl font-bold text-orange-900">
													{managementLoading
														? "..."
														: callManagementData?.data?.scheduledInQueue || 0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-indigo-100">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-3 bg-indigo-500 rounded-xl group-hover:bg-indigo-600 transition-colors duration-300">
												<Clock className="h-6 w-6 text-white" />
											</div>
											<div>
												<p className="text-sm font-medium text-indigo-700 mb-1">
													{t("activity.campaignInQueue")}
												</p>
												<p className="text-3xl font-bold text-indigo-900">
													{managementLoading
														? "..."
														: callManagementData?.data?.campaignInQueue || 0}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Stale Calls Management Section */}
						<Card className="border-0 shadow-xl bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400">
							<CardHeader className="pb-4">
								<CardTitle className="text-xl font-bold text-amber-900 flex items-center space-x-2">
									<AlertTriangle className="h-5 w-5 text-amber-600" />
									<span>Stale Calls Management</span>
								</CardTitle>
							</CardHeader>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<p className="text-sm text-amber-700 mb-2">
											Some calls may remain in "INITIATED" status if webhooks
											were missed. This can happen due to network issues or
											Vapi.ai service interruptions.
										</p>
										<p className="text-xs text-amber-600">
											The system automatically reconciles stale calls every 5
											minutes, but you can also trigger it manually.
										</p>
									</div>
									<Button
										variant="outline"
										onClick={async () => {
											try {
												const result =
													await callAPI.reconcileStaleCallsViaScheduler();
												if (result.success) {
													// Show success message
													console.log(
														`Reconciled ${result.data.finalized} stale calls`
													);
													// Refresh data
													queryClient.invalidateQueries({
														queryKey: ["call-history"],
													});
													queryClient.invalidateQueries({
														queryKey: ["recent-calls"],
													});
													queryClient.invalidateQueries({
														queryKey: ["call-management"],
													});
												}
											} catch (error) {
												console.error(
													"Failed to reconcile stale calls:",
													error
												);
											}
										}}
										className="ml-4 bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300"
									>
										<RefreshCw className="h-4 w-4 mr-2" />
										Reconcile Stale Calls
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
							<CardHeader className="pb-4">
								<CardTitle className="text-xl font-bold text-gray-900 flex items-center space-x-2">
									<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
									<span>{t("activity.recentActivity")}</span>
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								{callsLoading ? (
									<div className="text-center py-12">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
										<p className="text-gray-600">
											{t("activity.loadingActivityData")}
										</p>
									</div>
								) : activities.length === 0 ? (
									<div className="text-center py-12">
										<div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
											<Clock className="h-8 w-8 text-gray-400" />
										</div>
										<p className="text-gray-500 text-lg">
											{t("activity.noActivity")}
										</p>
										<p className="text-gray-400 text-sm">
											{t("activity.activityWillAppearHere")}
										</p>
									</div>
								) : (
									<ScrollArea className="h-96 px-6">
										<div className="space-y-4">
											{activities.map((activity) => {
												const StatusIcon =
													statusIcons[
														activity.status as keyof typeof statusIcons
													] || Clock;
												return (
													<div
														key={activity.id}
														className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 group"
													>
														<div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors duration-200">
															<StatusIcon className="h-5 w-5 text-gray-600" />
														</div>
														<div className="flex-1">
															<div className="flex items-center space-x-3 mb-2">
																<span className="font-semibold text-gray-900">
																	{activity.lead}
																</span>
																<Badge
																	variant={
																		statusColors[
																			activity.status as keyof typeof statusColors
																		] as any
																	}
																	className="text-xs font-medium"
																>
																	{translateStatus(activity.status)}
																</Badge>
																{activity.duration && (
																	<span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
																		{Math.round(activity.duration / 60)}m{" "}
																		{activity.duration % 60}s
																	</span>
																)}
															</div>
															<div className="text-sm text-gray-600 flex items-center space-x-2">
																<span>{formatPhoneNumber(activity.phone)}</span>
																<span className="text-gray-300">•</span>
																<span>{formatDate(activity.timestamp)}</span>
																{activity.campaignName && (
																	<>
																		<span className="text-gray-300">•</span>
																		<Link
																			to={`/dashboard/campaign/${activity.campaignId}`}
																			className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
																		>
																			{activity.campaignName}
																		</Link>
																		<span className="text-gray-300">•</span>
																		<span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
																			ID: {activity.campaignId}
																		</span>
																	</>
																)}
															</div>
															{activity.notes && (
																<div className="text-xs text-gray-500 mt-2 p-2 bg-blue-50 rounded-lg border-l-2 border-blue-200">
																	{activity.notes}
																</div>
															)}
														</div>
													</div>
												);
											})}
										</div>
									</ScrollArea>
								)}
							</CardContent>
						</Card>
					</div>
				</main>
			</div>
		</div>
	);
}
