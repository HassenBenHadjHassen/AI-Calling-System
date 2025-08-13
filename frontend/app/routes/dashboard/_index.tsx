"use client";

import { useEffect, memo } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { socketService } from "~/lib/socket";
import { leadAPI, campaignAPI, callAPI } from "~/services/api";
import {
	Upload,
	Users,
	BarChart3,
	Activity,
	TrendingUp,
	Phone,
	Calendar,
} from "lucide-react";

// Memoized dashboard section component for better performance
const DashboardSection = memo(({ section }: { section: any }) => {
	const IconComponent = section.icon;
	return (
		<Link to={section.href} className="block">
			<Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">{section.title}</CardTitle>
					<div className="flex items-center space-x-2">
						{section.count !== undefined && (
							<span className="text-lg font-bold text-gray-900">
								{section.count}
							</span>
						)}
						<Badge variant="secondary" className="text-xs">
							{section.badge}
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex items-center space-x-4">
						<div className={`p-2 rounded-lg ${section.color}`}>
							<IconComponent className="h-6 w-6 text-white" />
						</div>
						<div className="flex-1">
							<p className="text-sm text-gray-600">{section.description}</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
});

DashboardSection.displayName = "DashboardSection";

export default function DashboardIndex() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { t } = useTranslation();

	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	// Fetch real data from backend
	const { data: leadsData } = useQuery({
		queryKey: ["leads-overview"],
		queryFn: () => leadAPI.getLeads(),
		enabled: isAuthenticated,
	});

	const { data: campaignsData } = useQuery({
		queryKey: ["campaigns-overview"],
		queryFn: () => campaignAPI.getCampaigns(),
		enabled: isAuthenticated,
	});

	const { data: callStatsData } = useQuery({
		queryKey: ["call-stats-overview"],
		queryFn: () => callAPI.getCallStats(),
		enabled: isAuthenticated,
		refetchInterval: 30000, // Refresh every 30 seconds
	});

	const { data: activeCampaignsData } = useQuery({
		queryKey: ["active-campaigns-overview"],
		queryFn: () => campaignAPI.getAllActiveCampaigns(),
		enabled: isAuthenticated,
		refetchInterval: 10000, // Refresh every 10 seconds
	});

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

	// Don't render dashboard if not authenticated
	if (!isAuthenticated) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	// Calculate real statistics
	const totalLeads = leadsData?.data?.length || 0;
	const activeCampaigns =
		campaignsData?.data?.filter((c) => c.status === "ACTIVE").length || 0;
	const totalCalls =
		callStatsData?.data?.totalCalls || callStatsData?.data?.total || 0;
	const completedCalls =
		callStatsData?.data?.completedCalls || callStatsData?.data?.completed || 0;
	const successRate =
		totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

	const dashboardSections = [
		{
			title: t("dashboard.uploadLeads"),
			description: t("dashboard.uploadLeadsDesc"),
			icon: Upload,
			href: "/dashboard/upload",
			color: "bg-blue-500",
			badge: t("dashboard.badges.new"),
		},
		{
			title: t("dashboard.leadsManagement"),
			description: t("dashboard.leadsManagementDesc"),
			icon: Users,
			href: "/dashboard/leads",
			color: "bg-green-500",
			badge: t("dashboard.badges.active"),
			count: totalLeads,
		},
		{
			title: t("dashboard.campaigns"),
			description: t("dashboard.campaignsDesc"),
			icon: Phone,
			href: "/dashboard/campaign",
			color: "bg-purple-500",
			badge:
				activeCampaigns > 0
					? t("dashboard.badges.live")
					: t("dashboard.badges.ready"),
			count: activeCampaigns,
		},
		{
			title: t("dashboard.activity"),
			description: t("dashboard.activityDesc"),
			icon: Activity,
			href: "/dashboard/activity",
			color: "bg-orange-500",
			badge: t("dashboard.badges.live"),
		},
		{
			title: t("dashboard.statistics"),
			description: t("dashboard.statisticsDesc"),
			icon: BarChart3,
			href: "/dashboard/stats",
			color: "bg-indigo-500",
			badge: t("dashboard.badges.updated"),
		},
	];

	return (
		<div className="min-h-screen bg-gray-100">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						{t("dashboard.title")}
					</h1>
					<p className="text-gray-600">{t("dashboard.welcome")}</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{dashboardSections.map((section) => (
						<DashboardSection key={section.href} section={section} />
					))}
				</div>

				<div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center space-x-2">
								<TrendingUp className="h-5 w-5" />
								<span>{t("dashboard.quickStats")}</span>
							</CardTitle>
							<CardDescription>
								{t("dashboard.overviewOfSystem")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4">
								<div className="text-center">
									<div className="text-2xl font-bold text-blue-600">
										{totalLeads.toLocaleString()}
									</div>
									<div className="text-sm text-gray-600">
										{t("dashboard.totalLeads")}
									</div>
								</div>
								<div className="text-center">
									<div className="text-2xl font-bold text-green-600">
										{successRate}%
									</div>
									<div className="text-sm text-gray-600">
										{t("dashboard.successRate")}
									</div>
								</div>
								<div className="text-center">
									<div className="text-2xl font-bold text-purple-600">
										{activeCampaigns}
									</div>
									<div className="text-sm text-gray-600">
										{t("dashboard.activeCampaigns")}
									</div>
								</div>
								<div className="text-center">
									<div className="text-2xl font-bold text-orange-600">
										{totalCalls.toLocaleString()}
									</div>
									<div className="text-sm text-gray-600">
										{t("dashboard.totalCalls")}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center space-x-2">
								<Calendar className="h-5 w-5" />
								<span>{t("dashboard.recentActivity")}</span>
							</CardTitle>
							<CardDescription>
								{t("dashboard.latestSystemActivities")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{activeCampaignsData?.data &&
								activeCampaignsData.data.length > 0 ? (
									<div className="space-y-2">
										{activeCampaignsData.data.map((campaign) => (
											<div
												key={campaign.id}
												className="flex items-center space-x-3"
											>
												<div className="w-2 h-2 bg-green-500 rounded-full"></div>
												<div className="flex-1">
													<p className="text-sm font-medium">
														{t("dashboard.activeCampaign")}: {campaign.name}
													</p>
													<p className="text-xs text-gray-500">
														{t("dashboard.currentlyRunning")}
													</p>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="flex items-center space-x-3">
										<div className="w-2 h-2 bg-gray-400 rounded-full"></div>
										<div className="flex-1">
											<p className="text-sm font-medium">
												{t("dashboard.noActiveCampaigns")}
											</p>
											<p className="text-xs text-gray-500">
												{t("dashboard.startCampaign")}
											</p>
										</div>
									</div>
								)}

								{callStatsData?.data &&
									(callStatsData.data.completedCalls ||
										callStatsData.data.completed ||
										0) > 0 && (
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
											<div className="flex-1">
												<p className="text-sm font-medium">
													{callStatsData.data.completedCalls ||
														callStatsData.data.completed ||
														0}{" "}
													{t("dashboard.callsCompleted")}
												</p>
												<p className="text-xs text-gray-500">
													{t("dashboard.todaySuccessfulCalls")}
												</p>
											</div>
										</div>
									)}

								{leadsData?.data && leadsData.data.length > 0 && (
									<div className="flex items-center space-x-3">
										<div className="w-2 h-2 bg-purple-500 rounded-full"></div>
										<div className="flex-1">
											<p className="text-sm font-medium">
												{leadsData.data.length} {t("dashboard.leadsAvailable")}
											</p>
											<p className="text-xs text-gray-500">
												{t("dashboard.readyForCalling")}
											</p>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
