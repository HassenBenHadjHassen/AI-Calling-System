"use client";

import { useEffect } from "react";
import { Progress } from "@radix-ui/react-progress";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	Phone,
	CheckCircle,
	ArrowRight,
	TrendingUp,
	Clock,
	Users,
	Target,
	BarChart3,
} from "lucide-react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "~/components/ui/card";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { socketService } from "~/lib/socket";
import { callAPI } from "~/services/api";

export default function StatsPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { t } = useTranslation();

	// Move all hooks to the top, before any conditional logic
	const { data: stats, isLoading } = useQuery({
		queryKey: ["call-stats"],
		queryFn: () => callAPI.getCallStats(),
		refetchInterval: 30000, // Refresh every 30 seconds
		enabled: isAuthenticated, // Only run when authenticated
	});

	// Handle effects and conditional logic after hooks
	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	useEffect(() => {
		if (isAuthenticated && isClient) {
			// Connect to socket when dashboard loads
			socketService.connect();

			return () => {
				socketService.disconnect();
			};
		}
	}, [isAuthenticated, isClient]);

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

	// Calculate statistics after conditional returns
	const callStats = {
		totalCalls: stats?.data?.totalCalls || stats?.data?.total || 0,
		completedCalls: stats?.data?.completedCalls || stats?.data?.completed || 0,
		failedCalls: stats?.data?.failedCalls || stats?.data?.failed || 0,
		transferredCalls:
			stats?.data?.transferredCalls || stats?.data?.transferred || 0,
		initiatedCalls: stats?.data?.initiatedCalls || 0,
		averageDuration: stats?.data?.averageDuration || 0,
	};

	const conversionRate =
		callStats.totalCalls > 0
			? ((callStats.completedCalls + callStats.transferredCalls) /
					callStats.totalCalls) *
			  100
			: 0;

	const successRate =
		callStats.totalCalls > 0
			? (callStats.completedCalls / callStats.totalCalls) * 100
			: 0;

	const transferRate =
		callStats.totalCalls > 0
			? (callStats.transferredCalls / callStats.totalCalls) * 100
			: 0;

	if (isLoading) {
		return (
			<div className="flex h-screen bg-gray-100">
				<Sidebar />
				<div className="flex-1 flex flex-col overflow-hidden">
					<Topbar />
					<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
						<div className="space-y-6">
							<div>
								<h1 className="text-2xl font-bold text-gray-900">
									{t("stats.statistics")}
								</h1>
								<p className="text-gray-600">{t("stats.loadingStatistics")}</p>
							</div>
						</div>
					</main>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-gray-100">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
				<main className="flex-1 overflow-x-hidden overflow-y-hidden bg-gray-100 p-6">
					<div className="space-y-6">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">
								{t("stats.statisticsDashboard")}
							</h1>
							<p className="text-gray-600">{t("stats.overviewOfCalling")}</p>
						</div>

						{/* Key Metrics Cards */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										{t("stats.totalCalls")}
									</CardTitle>
									<Phone className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{(callStats.totalCalls || 0).toLocaleString()}
									</div>
									<p className="text-xs text-muted-foreground">
										{t("stats.allTimeCalls")}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										{t("stats.successfulCalls")}
									</CardTitle>
									<CheckCircle className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold text-green-600">
										{(callStats.completedCalls || 0).toLocaleString()}
									</div>
									<p className="text-xs text-muted-foreground">
										{successRate.toFixed(1)}% {t("stats.successRate")}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										{t("stats.transfers")}
									</CardTitle>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold text-yellow-600">
										{(callStats.transferredCalls || 0).toLocaleString()}
									</div>
									<p className="text-xs text-muted-foreground">
										{transferRate.toFixed(1)}% {t("stats.transferRate")}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										{t("stats.conversionRate")}
									</CardTitle>
									<TrendingUp className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold text-blue-600">
										{conversionRate.toFixed(1)}%
									</div>
									<p className="text-xs text-muted-foreground">
										{t("stats.successPlusTransfers")}
									</p>
								</CardContent>
							</Card>
						</div>

						{/* Detailed Stats */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>{t("stats.callPerformance")}</CardTitle>
									<CardDescription>{t("stats.callOutcomes")}</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>{t("stats.completedCalls")}</span>
											<span>
												{callStats.completedCalls || 0} (
												{successRate.toFixed(1)}%)
											</span>
										</div>
										<Progress value={successRate} className="h-2" />
									</div>

									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>{t("stats.transferredCalls")}</span>
											<span>
												{callStats.transferredCalls || 0} (
												{transferRate.toFixed(1)}%)
											</span>
										</div>
										<Progress value={transferRate} className="h-2" />
									</div>

									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>{t("stats.failedCalls")}</span>
											<span>
												{callStats.failedCalls || 0} (
												{(
													((callStats.failedCalls || 0) /
														(callStats.totalCalls || 1)) *
														100 || 0
												).toFixed(1)}
												%)
											</span>
										</div>
										<Progress
											value={
												((callStats.failedCalls || 0) /
													(callStats.totalCalls || 1)) *
													100 || 0
											}
											className="h-2"
										/>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>{t("stats.callDuration")}</CardTitle>
									<CardDescription>
										{t("stats.averageDuration")}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center space-x-2">
										<Clock className="h-5 w-5 text-gray-600" />
										<div>
											<p className="text-sm font-medium text-gray-600">
												{t("stats.averageDurationLabel")}
											</p>
											<p className="text-2xl font-bold">
												{Math.floor(callStats.averageDuration / 60)}
												{t("stats.minutes")} {callStats.averageDuration % 60}
												{t("stats.seconds")}
											</p>
										</div>
									</div>

									<div className="flex items-center space-x-2">
										<Users className="h-5 w-5 text-gray-600" />
										<div>
											<p className="text-sm font-medium text-gray-600">
												{t("stats.activeCalls")}
											</p>
											<p className="text-2xl font-bold">
												{callStats.initiatedCalls || 0}
											</p>
										</div>
									</div>

									<div className="flex items-center space-x-2">
										<Target className="h-5 w-5 text-gray-600" />
										<div>
											<p className="text-sm font-medium text-gray-600">
												{t("stats.efficiencyScore")}
											</p>
											<p className="text-2xl font-bold">
												{conversionRate.toFixed(0)}/100
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Additional Metrics */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<BarChart3 className="h-5 w-5 mr-2" />
									{t("stats.performanceSummary")}
								</CardTitle>
								<CardDescription>
									{t("stats.keyPerformanceIndicators")}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
									<div className="text-center p-4 bg-green-50 rounded-lg">
										<CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
										<p className="text-2xl font-bold text-green-600">
											{callStats.completedCalls || 0}
										</p>
										<p className="text-sm text-gray-600">
											{t("stats.successfulConnections")}
										</p>
									</div>

									<div className="text-center p-4 bg-yellow-50 rounded-lg">
										<ArrowRight className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
										<p className="text-2xl font-bold text-yellow-600">
											{callStats.transferredCalls || 0}
										</p>
										<p className="text-sm text-gray-600">
											{t("stats.qualifiedTransfers")}
										</p>
									</div>

									<div className="text-center p-4 bg-blue-50 rounded-lg">
										<TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
										<p className="text-2xl font-bold text-blue-600">
											{conversionRate.toFixed(1)}%
										</p>
										<p className="text-sm text-gray-600">
											{t("stats.overallConversion")}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</main>
			</div>
		</div>
	);
}
