"use client";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	ArrowLeft,
	Users,
	Phone,
	Clock,
	Calendar,
	BarChart3,
	Play,
	Square,
	Trash2,
	Download,
	RefreshCw,
	Plus,
	X,
	Menu,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import {
	campaignAPI,
	callAPI,
	leadAPI,
	type Campaign,
	type Lead,
	type CallHistory,
} from "~/services/api";
import { formatDate } from "~/lib/utils";
import { useToast } from "~/components/ui/toast";

export default function CampaignDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { addToast } = useToast();
	const [showAddLeadsModal, setShowAddLeadsModal] = useState(false);
	const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
	const [showStopCampaignModal, setShowStopCampaignModal] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<"overview" | "leads" | "calls">(
		"overview"
	);

	// Queries
	const { data: campaign, isLoading: campaignLoading } = useQuery({
		queryKey: ["campaign", id],
		queryFn: () => campaignAPI.getCampaign(id!),
		enabled: isAuthenticated && !!id,
		refetchInterval: 3000, // Refresh every 3 seconds
		refetchIntervalInBackground: true, // Continue refreshing even when tab is not active
	});

	const { data: callHistory, isLoading: callHistoryLoading } = useQuery({
		queryKey: ["campaign-calls", id],
		queryFn: () => callAPI.getCallHistory({ campaignId: id! }),
		enabled: isAuthenticated && !!id,
		refetchInterval: 5000, // Refresh every 5 seconds
		refetchIntervalInBackground: true, // Continue refreshing even when tab is not active
	});

	const { data: callStats, isLoading: statsLoading } = useQuery({
		queryKey: ["campaign-stats", id],
		queryFn: () => callAPI.getCallStats({ campaignId: id! }),
		enabled: isAuthenticated && !!id,
	});

	const {
		data: availableLeads,
		isLoading: availableLeadsLoading,
		error: availableLeadsError,
	} = useQuery({
		queryKey: ["available-leads"],
		queryFn: () => leadAPI.getAvailableLeads(),
		enabled: isAuthenticated && showAddLeadsModal,
	});

	const { data: leadStats, isLoading: leadStatsLoading } = useQuery({
		queryKey: ["lead-statistics"],
		queryFn: () => leadAPI.getLeadStatistics(),
		enabled:
			isAuthenticated &&
			showAddLeadsModal &&
			availableLeads?.data?.length === 0,
	});

	// Mutations
	const startCampaignMutation = useMutation({
		mutationFn: (campaignId: string) => campaignAPI.startCampaign(campaignId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaign", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
			queryClient.invalidateQueries({ queryKey: ["campaign-calls", id] });
		},
	});

	const stopCampaignMutation = useMutation({
		mutationFn: (campaignId: string) => campaignAPI.stopCampaign(campaignId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaign", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
		},
	});

	const deleteCampaignMutation = useMutation({
		mutationFn: (campaignId: string) => campaignAPI.deleteCampaign(campaignId),
		onSuccess: () => {
			navigate("/dashboard/campaign");
		},
	});

	const addLeadsToCampaignMutation = useMutation({
		mutationFn: (leadIds: string[]) =>
			campaignAPI.addLeadsToCampaign(id!, { leadIds }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaign", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["available-leads"] });
			setShowAddLeadsModal(false);
			setSelectedLeads([]);
		},
	});

	const removeLeadFromCampaignMutation = useMutation({
		mutationFn: (leadId: string) =>
			campaignAPI.removeLeadFromCampaign(id!, leadId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaign", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["available-leads"] });
		},
	});

	const cleanupOrphanedLeadsMutation = useMutation({
		mutationFn: () => leadAPI.cleanupOrphanedLeads(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["available-leads"] });
			queryClient.invalidateQueries({ queryKey: ["lead-statistics"] });
		},
	});

	// Effects
	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	// Socket connection is handled by the dashboard layout
	// No need to connect/disconnect here

	// Auto-stop campaign when all calls are completed
	useEffect(() => {
		if (
			campaign?.data?.status === "ACTIVE" &&
			callHistory?.data &&
			campaign?.data?.leads &&
			!stopCampaignMutation.isPending
		) {
			const totalLeads = campaign.data.leads.length;
			const completedCalls = callHistory.data.filter(
				(call) =>
					call.callStatus === "COMPLETED" ||
					call.callStatus === "FAILED" ||
					call.callStatus === "TRANSFERRED"
			).length;

			// If all leads have been called (completed, failed, or transferred), auto-stop the campaign
			if (completedCalls >= totalLeads && totalLeads > 0) {
				console.log(
					`Auto-stopping campaign: ${completedCalls}/${totalLeads} calls completed`
				);
				stopCampaignMutation.mutate(campaign.data.id);
			}
		}
	}, [
		campaign?.data?.status,
		callHistory?.data,
		campaign?.data?.leads,
		stopCampaignMutation.isPending,
	]);

	// Handlers
	const handleToggleCampaign = () => {
		if (!campaign?.data) return;

		if (campaign.data.status === "ACTIVE") {
			setShowStopCampaignModal(true);
		} else if (
			campaign.data.status === "STOPPED" ||
			campaign.data.status === "COMPLETED"
		) {
			startCampaignMutation.mutate(campaign.data.id);
		} else {
			// For any other status, try to start the campaign
			startCampaignMutation.mutate(campaign.data.id);
		}
	};

	const handleDeleteCampaign = () => {
		if (!campaign?.data) return;

		if (confirm(t("campaigns.confirmDeleteCampaign"))) {
			deleteCampaignMutation.mutate(campaign.data.id);
		}
	};

	const handleAddLeads = () => {
		if (selectedLeads.length === 0) return;
		addLeadsToCampaignMutation.mutate(selectedLeads);
	};

	const handleLeadSelection = (leadId: string, checked: boolean) => {
		if (checked) {
			setSelectedLeads([...selectedLeads, leadId]);
		} else {
			setSelectedLeads(selectedLeads.filter((id) => id !== leadId));
		}
	};

	const handleRemoveLead = (leadId: string) => {
		if (confirm(t("campaigns.confirmRemoveLead"))) {
			removeLeadFromCampaignMutation.mutate(leadId);
		}
	};

	const handleConfirmStopCampaign = () => {
		if (!campaign?.data) return;

		// Check if campaign is still active before attempting to stop it
		if (campaign.data.status !== "ACTIVE") {
			addToast(t("campaigns.campaignAlreadyStopped"), "info");
			setShowStopCampaignModal(false);
			return;
		}

		stopCampaignMutation.mutate(campaign.data.id);
		setShowStopCampaignModal(false);
	};

	const handleCancelStopCampaign = () => {
		setShowStopCampaignModal(false);
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return "default";
			case "STOPPED":
				return "secondary";
			case "COMPLETED":
				return "outline";
			default:
				return "default";
		}
	};

	const getLeadStatusColor = (status: string) => {
		switch (status) {
			case "NEW":
				return "secondary";
			case "CALLED":
				return "default";
			case "INTERESTED":
				return "default";
			case "TRANSFERRED":
				return "outline";
			case "FAILED":
				return "destructive";
			case "BLACKLISTED":
				return "destructive";
			case "SCHEDULED":
				return "outline";
			default:
				return "secondary";
		}
	};

	const getCallStatusColor = (status: string) => {
		switch (status) {
			case "INITIATED":
				return "secondary";
			case "COMPLETED":
				return "default";
			case "TRANSFERRED":
				return "outline";
			case "FAILED":
				return "destructive";
			case "SCHEDULED":
				return "outline";
			default:
				return "secondary";
		}
	};

	// Loading states
	if (!isClient) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	if (campaignLoading) {
		return (
			<div className="min-h-screen bg-gray-50">
				<Sidebar
					isOpen={isSidebarOpen}
					onClose={() => setIsSidebarOpen(false)}
				/>
				<div className="lg:ml-64">
					<div className="lg:hidden">
						<div className="flex items-center justify-center min-h-screen">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
						</div>
					</div>
					<div className="hidden lg:flex h-screen bg-gray-100">
						<Sidebar
							isOpen={isSidebarOpen}
							onClose={() => setIsSidebarOpen(false)}
						/>
						<div className="flex-1 flex flex-col overflow-hidden">
							<Topbar onMenuClick={() => setIsSidebarOpen((v) => !v)} />
							<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
								<div className="text-center py-8">
									{t("campaigns.loadingCampaignDetails")}
								</div>
							</main>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!campaign?.data) {
		return (
			<div className="min-h-screen bg-gray-50">
				<Sidebar
					isOpen={isSidebarOpen}
					onClose={() => setIsSidebarOpen(false)}
				/>
				<div className="lg:ml-64">
					<div className="lg:hidden">
						<div className="flex items-center justify-center min-h-screen">
							<Alert variant="destructive" className="mx-4">
								<AlertDescription>
									{t("campaigns.campaignNotFound")}
								</AlertDescription>
							</Alert>
						</div>
					</div>
					<div className="hidden lg:flex h-screen bg-gray-100">
						<Sidebar
							isOpen={isSidebarOpen}
							onClose={() => setIsSidebarOpen(false)}
						/>
						<div className="flex-1 flex flex-col overflow-hidden">
							<Topbar onMenuClick={() => setIsSidebarOpen((v) => !v)} />
							<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
								<Alert variant="destructive">
									<AlertDescription>
										{t("campaigns.campaignNotFound")}
									</AlertDescription>
								</Alert>
							</main>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const campaignData = campaign.data;

	return (
		<div className="min-h-screen bg-gray-50">
			<Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
			<div className="lg:ml-64">
				{/* Mobile Header - Only on Mobile */}
				<div className="lg:hidden">
					<div className="flex items-center space-x-3 mb-4 p-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsSidebarOpen(true)}
							className="p-2 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 border-0"
						>
							<Menu className="h-5 w-5 text-gray-600" />
						</Button>
						<div className="flex-1">
							<h1 className="text-xl font-bold text-gray-900">
								{campaignData.name}
							</h1>
							<p className="text-sm text-gray-500">
								{t("campaigns.campaignDetails")}
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate("/dashboard/campaign")}
							className="p-2 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 border-0"
						>
							<ArrowLeft className="h-5 w-5 text-gray-600" />
						</Button>
					</div>

					{/* Mobile Tab Navigation */}
					<div className="flex space-x-1 bg-white p-2 mx-4 rounded-xl shadow-sm border">
						<button
							onClick={() => setActiveTab("overview")}
							className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
								activeTab === "overview"
									? "bg-blue-50 text-blue-700 border border-blue-200"
									: "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
							}`}
						>
							{t("campaigns.campaignInfo")}
						</button>
						<button
							onClick={() => setActiveTab("leads")}
							className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
								activeTab === "leads"
									? "bg-blue-50 text-blue-700 border border-blue-200"
									: "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
							}`}
						>
							{t("common.leads")}
						</button>
						<button
							onClick={() => setActiveTab("calls")}
							className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
								activeTab === "calls"
									? "bg-blue-50 text-blue-700 border border-blue-200"
									: "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
							}`}
						>
							{t("leadDetail.callHistory")}
						</button>
					</div>
				</div>

				{/* Desktop Header - Only on Desktop */}
				<div className="hidden lg:block">
					<Topbar onMenuClick={() => setIsSidebarOpen((v) => !v)} />
				</div>

				<main className="lg:ml-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:bg-gray-100 lg:p-6">
					<div className="lg:space-y-6">
						{/* Desktop Header */}
						<div className="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
							<div className="flex items-center space-x-3 sm:space-x-4">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => navigate("/dashboard/campaign")}
									className="p-2 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 border-0 sm:p-2 sm:h-auto sm:rounded-lg sm:bg-transparent sm:hover:bg-gray-50"
								>
									<ArrowLeft className="h-5 w-5 text-gray-600 sm:h-4 sm:w-4 sm:mr-2" />
									<span className="hidden sm:inline">
										{t("campaigns.backToCampaigns")}
									</span>
								</Button>
								<div>
									<h1 className="text-xl sm:text-2xl font-bold text-gray-900">
										{campaignData.name}
									</h1>
									<p className="text-gray-600 text-sm sm:text-base">
										{t("campaigns.campaignDetails")}
									</p>
								</div>
							</div>
							<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
								<Badge
									variant={getStatusColor(campaignData.status) as any}
									className="text-xs sm:text-sm"
								>
									{campaignData.status}
								</Badge>
								<Button
									variant={
										campaignData.status === "ACTIVE" ? "destructive" : "default"
									}
									onClick={handleToggleCampaign}
									disabled={
										startCampaignMutation.isPending ||
										stopCampaignMutation.isPending
									}
									className="text-xs sm:text-sm"
								>
									{campaignData.status === "ACTIVE" ? (
										<>
											<Square className="h-4 w-4 mr-2" />
											{t("campaigns.stopCampaign")}
										</>
									) : (
										<>
											<Play className="h-4 w-4 mr-2" />
											{t("campaigns.startCampaign")}
										</>
									)}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="text-red-600 hover:text-red-700"
									onClick={handleDeleteCampaign}
									disabled={deleteCampaignMutation.isPending}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Campaign Overview - Desktop Only */}
						<div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-xs sm:text-sm font-medium">
										{t("campaigns.campaignInfo")}
									</CardTitle>
									<Calendar className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-xs sm:text-sm text-gray-600">
												ID
											</span>
											<span
												className="text-xs sm:text-sm font-mono cursor-pointer hover:text-blue-600 transition-colors break-all"
												onClick={() => {
													navigator.clipboard.writeText(campaignData.id);
													addToast(
														t("campaigns.idCopiedToClipboard"),
														"success"
													);
												}}
												title="Click to copy ID"
											>
												{campaignData.id}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-xs sm:text-sm text-gray-600">
												{t("campaigns.started")}
											</span>
											<span className="text-xs sm:text-sm">
												{campaignData.startedAt
													? formatDate(campaignData.startedAt)
													: t("campaigns.notStarted")}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-xs sm:text-sm text-gray-600">
												{t("campaigns.stopped")}
											</span>
											<span className="text-xs sm:text-sm">
												{campaignData.stoppedAt
													? formatDate(campaignData.stoppedAt)
													: t("campaigns.notStopped")}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-xs sm:text-sm font-medium">
										{t("common.leads")}
									</CardTitle>
									<Users className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-xl sm:text-2xl font-bold">
										{campaignData.leads?.length || 0}
									</div>
									<p className="text-xs sm:text-sm text-muted-foreground">
										{t("campaigns.totalLeadsInCampaign")}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-xs sm:text-sm font-medium">
										{t("campaigns.callStats")}
									</CardTitle>
									<BarChart3 className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									{statsLoading ? (
										<div className="text-xs sm:text-sm">
											{t("campaigns.loadingStats")}
										</div>
									) : (
										<div className="space-y-1">
											<div className="flex justify-between text-xs sm:text-sm">
												<span>{t("campaigns.total")}</span>
												<span>{callStats?.data?.total || 0}</span>
											</div>
											<div className="flex justify-between text-xs sm:text-sm">
												<span>{t("campaigns.completed")}</span>
												<span>{callStats?.data?.completed || 0}</span>
											</div>
											<div className="flex justify-between text-xs sm:text-sm">
												<span>{t("campaigns.failed")}</span>
												<span>{callStats?.data?.failed || 0}</span>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						{/* Leads Section - Desktop Only */}
						<div className="hidden lg:block">
							<Card>
								<CardHeader>
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
										<div>
											<CardTitle className="text-lg sm:text-xl">
												{t("campaigns.campaignLeads")}
											</CardTitle>
											<CardDescription className="text-sm">
												{t("campaigns.allLeadsAssociated")}
											</CardDescription>
										</div>
										<Button
											onClick={() => setShowAddLeadsModal(true)}
											disabled={campaignData.status === "COMPLETED"}
											className="text-sm"
										>
											<Plus className="h-4 w-4 mr-2" />
											{t("campaigns.addLeads")}
										</Button>
									</div>
								</CardHeader>
								<CardContent>
									{campaignData.leads?.length === 0 ? (
										<div className="text-center py-8 text-gray-500">
											{t("campaigns.noLeadsInCampaign")}
										</div>
									) : (
										<>
											{/* Desktop view */}
											<div className="hidden sm:block overflow-x-auto">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead className="text-xs sm:text-sm">
																{t("common.name")}
															</TableHead>
															<TableHead className="text-xs sm:text-sm">
																{t("common.phone")}
															</TableHead>
															<TableHead className="text-xs sm:text-sm">
																{t("common.status")}
															</TableHead>
															<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																{t("common.city")}
															</TableHead>
															<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																{t("common.date")}
															</TableHead>
															<TableHead className="text-xs sm:text-sm">
																{t("common.actions")}
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{campaignData.leads?.map((lead) => (
															<TableRow key={lead.id}>
																<TableCell className="font-medium text-xs sm:text-sm">
																	{lead.name}
																</TableCell>
																<TableCell className="text-xs sm:text-sm">
																	{lead.phone1}
																</TableCell>
																<TableCell>
																	<Badge
																		variant={
																			getLeadStatusColor(lead.status) as any
																		}
																		className="text-xs"
																	>
																		{t(`leads.${lead.status.toLowerCase()}`)}
																	</Badge>
																</TableCell>
																<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																	{lead.city || "-"}
																</TableCell>
																<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																	{formatDate(lead.createdAt)}
																</TableCell>
																<TableCell>
																	<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
																		<Button
																			variant="outline"
																			size="sm"
																			onClick={() =>
																				navigate(`/dashboard/leads/${lead.id}`)
																			}
																			className="text-xs"
																		>
																			{t("campaigns.viewDetails")}
																		</Button>
																		<Button
																			variant="ghost"
																			size="sm"
																			className="text-red-600 hover:text-red-700 text-xs"
																			onClick={() => handleRemoveLead(lead.id)}
																			disabled={
																				removeLeadFromCampaignMutation.isPending
																			}
																		>
																			<Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
																		</Button>
																	</div>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>

											{/* Mobile/Card view */}
											<div className="sm:hidden space-y-3">
												{campaignData.leads?.map((lead) => (
													<div
														key={lead.id}
														className="rounded-lg border bg-white p-3 shadow-sm"
													>
														<div className="flex items-start justify-between mb-3">
															<div className="flex-1">
																<h3 className="font-semibold text-sm text-gray-900 mb-1">
																	{lead.name}
																</h3>
																<div className="text-xs text-gray-600">
																	{lead.phone1}
																</div>
															</div>
															<Badge
																variant={getLeadStatusColor(lead.status) as any}
																className="text-[10px]"
															>
																{t(`leads.${lead.status.toLowerCase()}`)}
															</Badge>
														</div>
														<div className="space-y-1 text-xs text-gray-700 mb-3">
															<div>
																<span className="text-gray-500">
																	{t("common.city")}:
																</span>
																<span className="ml-1">{lead.city || "-"}</span>
															</div>
															<div>
																<span className="text-gray-500">
																	{t("common.date")}:
																</span>
																<span className="ml-1">
																	{formatDate(lead.createdAt)}
																</span>
															</div>
														</div>
														<div className="flex space-x-2">
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	navigate(`/dashboard/leads/${lead.id}`)
																}
																className="text-xs flex-1"
															>
																{t("campaigns.viewDetails")}
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="text-red-600 hover:text-red-700 text-xs"
																onClick={() => handleRemoveLead(lead.id)}
																disabled={
																	removeLeadFromCampaignMutation.isPending
																}
															>
																<Trash2 className="h-3 w-3" />
															</Button>
														</div>
													</div>
												))}
											</div>
										</>
									)}
								</CardContent>
							</Card>
						</div>

						{/* Call History Section - Desktop Only */}
						<div className="hidden lg:block">
							<Card>
								<CardHeader>
									<CardTitle className="text-lg sm:text-xl">
										{t("leadDetail.callHistory")}
									</CardTitle>
									<CardDescription className="text-sm">
										{t("campaigns.recentCalls")}
									</CardDescription>
								</CardHeader>
								<CardContent>
									{callHistoryLoading ? (
										<div className="text-center py-8">
											{t("campaigns.loadingCallHistory")}
										</div>
									) : callHistory?.data?.length === 0 ? (
										<div className="text-center py-8 text-gray-500">
											{t("campaigns.noCallHistoryForCampaign")}
										</div>
									) : (
										<>
											{/* Desktop view */}
											<div className="hidden sm:block overflow-x-auto">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead className="text-xs sm:text-sm">
																{t("common.leads")}
															</TableHead>
															<TableHead className="text-xs sm:text-sm">
																{t("common.status")}
															</TableHead>
															<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																{t("common.duration")}
															</TableHead>
															<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																{t("campaigns.transferred")}
															</TableHead>
															<TableHead className="text-xs sm:text-sm">
																{t("campaigns.callTime")}
															</TableHead>
															<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																{t("common.notes")}
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{callHistory?.data?.map((call) => (
															<TableRow key={call.id}>
																<TableCell className="font-medium text-xs sm:text-sm">
																	{call.lead?.name || t("activity.unknownLead")}
																</TableCell>
																<TableCell>
																	<Badge
																		variant={
																			getCallStatusColor(call.callStatus) as any
																		}
																		className="text-xs"
																	>
																		{t(
																			`campaigns.callStatus.${call.callStatus.toLowerCase()}`
																		)}
																	</Badge>
																</TableCell>
																<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																	{call.duration
																		? `${Math.round(call.duration / 60)}${t(
																				"activity.minutes"
																		  )} ${call.duration % 60}${t(
																				"activity.seconds"
																		  )}`
																		: "-"}
																</TableCell>
																<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																	{call.transferred
																		? t("leadDetail.yes")
																		: t("leadDetail.no")}
																</TableCell>
																<TableCell className="text-xs sm:text-sm">
																	{formatDate(call.callTime)}
																</TableCell>
																<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																	{call.notes || t("activity.noNotes")}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>

											{/* Mobile/Card view */}
											<div className="sm:hidden space-y-3">
												{callHistory?.data?.map((call) => (
													<div
														key={call.id}
														className="p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all duration-200"
													>
														<div className="flex items-center justify-between mb-3">
															<Badge
																variant={
																	call.callStatus === "COMPLETED"
																		? "default"
																		: call.callStatus === "FAILED"
																		? "destructive"
																		: "secondary"
																}
																className="text-xs px-3 py-1"
															>
																{t(
																	`campaigns.callStatus.${call.callStatus.toLowerCase()}`
																)}
															</Badge>
															<span className="text-xs text-gray-500 font-medium">
																{formatDate(call.callTime)}
															</span>
														</div>
														<div className="space-y-2 text-sm text-gray-600">
															<div>
																<span className="text-gray-500">
																	{t("common.leads")}:
																</span>
																<span className="ml-1 font-medium">
																	{call.lead?.name || t("activity.unknownLead")}
																</span>
															</div>
															{call.duration && (
																<div>
																	<span className="text-gray-500">
																		{t("common.duration")}:
																	</span>
																	<span className="ml-1">
																		{`${Math.round(call.duration / 60)}${t(
																			"activity.minutes"
																		)} ${call.duration % 60}${t(
																			"activity.seconds"
																		)}`}
																	</span>
																</div>
															)}
															<div>
																<span className="text-gray-500">
																	{t("campaigns.transferred")}:
																</span>
																<span className="ml-1">
																	{call.transferred
																		? t("leadDetail.yes")
																		: t("leadDetail.no")}
																</span>
															</div>
															{call.notes && (
																<div className="bg-white p-3 rounded-lg border border-gray-100 mt-2">
																	<span className="text-gray-500 text-xs">
																		{t("common.notes")}:
																	</span>
																	<div className="text-sm mt-1">
																		{call.notes.length > 50
																			? `${call.notes.substring(0, 50)}...`
																			: call.notes}
																	</div>
																</div>
															)}
														</div>
													</div>
												))}
											</div>
										</>
									)}
								</CardContent>
							</Card>
						</div>

						{/* Add Leads Modal */}
						{showAddLeadsModal && (
							<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
								<div className="bg-white rounded-lg w-full max-w-4xl mx-auto max-h-[90vh] flex flex-col">
									{/* Header */}
									<div className="flex justify-between items-center p-4 sm:p-6 border-b">
										<h2 className="text-lg sm:text-xl font-semibold">
											{t("campaigns.addLeadsToCampaign")}
										</h2>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setShowAddLeadsModal(false);
												setSelectedLeads([]);
											}}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>

									{/* Content */}
									<div className="flex-1 overflow-hidden">
										{availableLeadsError ? (
											<div className="text-center py-8 text-red-500">
												{t("campaigns.errorLoadingLeads")}{" "}
												{availableLeadsError.message}
											</div>
										) : availableLeadsLoading ? (
											<div className="text-center py-8">
												{t("campaigns.loadingAvailableLeads")}
											</div>
										) : availableLeads?.data?.length === 0 ? (
											<div className="text-center py-8">
												<div className="text-gray-500 mb-4">
													{t("campaigns.noAvailableLeadsFound")}
												</div>
											</div>
										) : (
											<div className="p-4 sm:p-6 space-y-4">
												<div className="text-xs sm:text-sm text-gray-600">
													{t("campaigns.selectLeadsToAddToCampaign")}
												</div>

												{/* Scrollable Table Container */}
												<div className="overflow-y-auto max-h-[300px] sm:max-h-[400px] border rounded-lg">
													<Table>
														<TableHeader className="sticky top-0 bg-white z-10">
															<TableRow>
																<TableHead className="w-12">
																	<input
																		type="checkbox"
																		checked={
																			selectedLeads.length ===
																			availableLeads?.data?.length
																		}
																		onChange={(e) => {
																			if (e.target.checked) {
																				setSelectedLeads(
																					availableLeads?.data?.map(
																						(lead: Lead) => lead.id
																					) || []
																				);
																			} else {
																				setSelectedLeads([]);
																			}
																		}}
																	/>
																</TableHead>
																<TableHead className="text-xs sm:text-sm">
																	{t("common.name")}
																</TableHead>
																<TableHead className="text-xs sm:text-sm">
																	{t("common.phone")}
																</TableHead>
																<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																	{t("common.city")}
																</TableHead>
																<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
																	{t("common.date")}
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{availableLeads?.data?.map((lead: Lead) => (
																<TableRow key={lead.id}>
																	<TableCell>
																		<input
																			type="checkbox"
																			checked={selectedLeads.includes(lead.id)}
																			onChange={(e) =>
																				handleLeadSelection(
																					lead.id,
																					e.target.checked
																				)
																			}
																		/>
																	</TableCell>
																	<TableCell className="font-medium text-xs sm:text-sm">
																		{lead.name}
																	</TableCell>
																	<TableCell className="text-xs sm:text-sm">
																		{lead.phone1}
																	</TableCell>
																	<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																		{lead.city || "-"}
																	</TableCell>
																	<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
																		{formatDate(lead.createdAt)}
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</div>

												{selectedLeads.length +
													(campaignData.leads?.length || 0) >
													5 && (
													<Alert variant="destructive">
														<AlertDescription className="text-xs sm:text-sm">
															{t("campaigns.cannotAddMoreThan5")}{" "}
															{campaignData.leads?.length || 0},{" "}
															{t("campaigns.selected")} {selectedLeads.length}
														</AlertDescription>
													</Alert>
												)}
											</div>
										)}
									</div>

									{/* Footer with Static Buttons */}
									<div className="border-t p-4 sm:p-6 bg-gray-50">
										<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
											<div className="text-xs sm:text-sm text-gray-600">
												{t("campaigns.selected")} {selectedLeads.length}{" "}
												{t("campaigns.leads")}
											</div>
											<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
												<Button
													onClick={handleAddLeads}
													disabled={
														selectedLeads.length === 0 ||
														addLeadsToCampaignMutation.isPending ||
														selectedLeads.length +
															(campaignData.leads?.length || 0) >
															5
													}
													className="text-sm"
												>
													{addLeadsToCampaignMutation.isPending
														? t("campaigns.adding")
														: t("campaigns.addSelectedLeads")}
												</Button>
												<Button
													variant="outline"
													onClick={() => {
														setShowAddLeadsModal(false);
														setSelectedLeads([]);
													}}
													disabled={addLeadsToCampaignMutation.isPending}
													className="text-sm"
												>
													{t("common.cancel")}
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Stop Campaign Confirmation Modal */}
						{showStopCampaignModal && (
							<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
								<div className="bg-white rounded-lg w-full max-w-md mx-auto">
									{/* Header */}
									<div className="flex justify-between items-center p-4 sm:p-6 border-b">
										<h2 className="text-lg sm:text-xl font-semibold text-red-600">
											{t("campaigns.stopCampaign")}
										</h2>
										<Button
											variant="ghost"
											size="sm"
											onClick={handleCancelStopCampaign}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>

									{/* Content */}
									<div className="p-4 sm:p-6">
										<div className="space-y-4">
											<div className="flex items-start space-x-3">
												<div className="flex-shrink-0 mt-1">
													<div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
														<Square className="h-4 w-4 text-red-600" />
													</div>
												</div>
												<div className="flex-1">
													<h3 className="text-base sm:text-lg font-medium text-gray-900">
														{t("campaigns.stopCampaignWarning")}
													</h3>
													<p className="text-xs sm:text-sm text-gray-600 mt-2">
														{t("campaigns.stopCampaignDescription")}
													</p>
												</div>
											</div>

											<Alert variant="destructive">
												<AlertDescription className="text-xs sm:text-sm">
													{t("campaigns.stopCampaignAlert")}
												</AlertDescription>
											</Alert>
										</div>
									</div>

									{/* Footer */}
									<div className="border-t p-4 sm:p-6 bg-gray-50">
										<div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
											<Button
												variant="outline"
												onClick={handleCancelStopCampaign}
												disabled={stopCampaignMutation.isPending}
												className="text-sm"
											>
												{t("common.cancel")}
											</Button>
											<Button
												variant="destructive"
												onClick={handleConfirmStopCampaign}
												disabled={stopCampaignMutation.isPending}
												className="text-sm"
											>
												{stopCampaignMutation.isPending ? (
													<>
														<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
														{t("campaigns.stopping")}
													</>
												) : (
													<>
														<Square className="h-4 w-4 mr-2" />
														{t("campaigns.stopCampaign")}
													</>
												)}
											</Button>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Error Alerts */}
						{(startCampaignMutation.isError ||
							stopCampaignMutation.isError ||
							deleteCampaignMutation.isError ||
							addLeadsToCampaignMutation.isError ||
							removeLeadFromCampaignMutation.isError ||
							cleanupOrphanedLeadsMutation.isError) && (
							<Alert variant="destructive">
								<AlertDescription className="text-xs sm:text-sm">
									{t("errors.failedToUpdateCampaign")}
								</AlertDescription>
							</Alert>
						)}
					</div>
				</main>
			</div>

			{/* Mobile Content - Only on Mobile */}
			<div className="lg:hidden">
				{activeTab === "overview" && (
					<div className="space-y-4 p-4">
						{/* Campaign Overview Cards */}
						<div className="grid grid-cols-1 gap-4">
							<Card className="border-0 shadow-lg bg-white rounded-2xl">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
									<CardTitle className="text-lg font-semibold">
										{t("campaigns.campaignInfo")}
									</CardTitle>
									<Calendar className="h-5 w-5 text-blue-600" />
								</CardHeader>
								<CardContent className="space-y-4">
									{/* Campaign Actions - Moved to top */}
									<div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
										<Badge
											variant={getStatusColor(campaignData.status) as any}
											className="text-sm px-3 py-1"
										>
											{campaignData.status}
										</Badge>
										<Button
											variant={
												campaignData.status === "ACTIVE"
													? "destructive"
													: "default"
											}
											onClick={handleToggleCampaign}
											disabled={
												startCampaignMutation.isPending ||
												stopCampaignMutation.isPending
											}
											className="text-sm"
										>
											{campaignData.status === "ACTIVE" ? (
												<>
													<Square className="h-4 w-4 mr-2" />
													{t("campaigns.stopCampaign")}
												</>
											) : (
												<>
													<Play className="h-4 w-4 mr-2" />
													{t("campaigns.startCampaign")}
												</>
											)}
										</Button>
									</div>

									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm text-gray-600">ID</span>
											<span
												className="text-sm font-mono cursor-pointer hover:text-blue-600 transition-colors break-all"
												onClick={() => {
													navigator.clipboard.writeText(campaignData.id);
													addToast(
														t("campaigns.idCopiedToClipboard"),
														"success"
													);
												}}
												title="Click to copy ID"
											>
												{campaignData.id}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-gray-600">
												{t("campaigns.started")}
											</span>
											<span className="text-sm font-medium">
												{campaignData.startedAt
													? formatDate(campaignData.startedAt)
													: t("campaigns.notStarted")}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-gray-600">
												{t("campaigns.stopped")}
											</span>
											<span className="text-sm font-medium">
												{campaignData.stoppedAt
													? formatDate(campaignData.stoppedAt)
													: t("campaigns.notStopped")}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="border-0 shadow-lg bg-white rounded-2xl">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
									<CardTitle className="text-lg font-semibold">
										{t("common.leads")}
									</CardTitle>
									<Users className="h-5 w-5 text-blue-600" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold text-gray-900">
										{campaignData.leads?.length || 0}
									</div>
									<p className="text-sm text-gray-600">
										{t("campaigns.totalLeadsInCampaign")}
									</p>
								</CardContent>
							</Card>

							<Card className="border-0 shadow-lg bg-white rounded-2xl">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
									<CardTitle className="text-lg font-semibold">
										{t("campaigns.callStats")}
									</CardTitle>
									<BarChart3 className="h-5 w-5 text-blue-600" />
								</CardHeader>
								<CardContent>
									{statsLoading ? (
										<div className="text-sm text-gray-600">
											{t("campaigns.loadingStats")}
										</div>
									) : (
										<div className="space-y-3">
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">
													{t("campaigns.total")}
												</span>
												<span className="font-medium">
													{callStats?.data?.total || 0}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">
													{t("campaigns.completed")}
												</span>
												<span className="font-medium">
													{callStats?.data?.completed || 0}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">
													{t("campaigns.failed")}
												</span>
												<span className="font-medium">
													{callStats?.data?.failed || 0}
												</span>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						{/* Campaign Actions - Removed from here since moved to top */}
					</div>
				)}

				{activeTab === "leads" && (
					<div className="space-y-4 p-4">
						<Card className="border-0 shadow-lg bg-white rounded-2xl">
							<CardHeader>
								<div className="flex flex-col space-y-4">
									<div>
										<CardTitle className="text-xl font-bold">
											{t("campaigns.campaignLeads")}
										</CardTitle>
										<CardDescription className="text-sm text-gray-600">
											{t("campaigns.allLeadsAssociated")}
										</CardDescription>
									</div>
									<Button
										onClick={() => setShowAddLeadsModal(true)}
										disabled={campaignData.status === "COMPLETED"}
										className="w-full bg-blue-600 hover:bg-blue-700"
									>
										<Plus className="h-4 w-4 mr-2" />
										{t("campaigns.addLeads")}
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								{campaignData.leads?.length === 0 ? (
									<div className="text-center py-8 text-gray-500">
										{t("campaigns.noLeadsInCampaign")}
									</div>
								) : (
									<div className="space-y-4">
										{campaignData.leads?.map((lead) => (
											<div
												key={lead.id}
												className="rounded-xl border bg-gray-50 p-5 shadow-sm hover:shadow-md transition-shadow"
											>
												<div className="flex items-start justify-between mb-4">
													<div className="flex-1">
														<h3 className="font-bold text-lg text-gray-900 mb-2">
															{lead.name}
														</h3>
														<div className="text-base text-gray-700 font-medium">
															{lead.phone1}
														</div>
													</div>
													<Badge
														variant={getLeadStatusColor(lead.status) as any}
														className="text-sm px-3 py-2 font-semibold"
													>
														{t(`leads.${lead.status.toLowerCase()}`)}
													</Badge>
												</div>
												<div className="space-y-2 text-base text-gray-700 mb-4">
													<div className="flex items-center">
														<span className="text-gray-500 font-medium min-w-[60px]">
															{t("common.city")}:
														</span>
														<span className="ml-3 font-medium">
															{lead.city || "-"}
														</span>
													</div>
													<div className="flex items-center">
														<span className="text-gray-500 font-medium min-w-[60px]">
															{t("common.date")}:
														</span>
														<span className="ml-3 font-medium">
															{formatDate(lead.createdAt)}
														</span>
													</div>
												</div>
												<div className="flex space-x-3">
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															navigate(`/dashboard/leads/${lead.id}`)
														}
														className="text-sm flex-1 h-10 font-medium"
													>
														{t("campaigns.viewDetails")}
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="text-red-600 hover:text-red-700 text-sm h-10"
														onClick={() => handleRemoveLead(lead.id)}
														disabled={removeLeadFromCampaignMutation.isPending}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}

				{activeTab === "calls" && (
					<div className="space-y-4 p-4">
						{/* Call History Header */}
						<div className="bg-white rounded-2xl p-4 shadow-sm border">
							<h2 className="text-xl font-bold text-gray-900 mb-2">
								{t("leadDetail.callHistory")}
							</h2>
							<p className="text-sm text-gray-600">
								{t("campaigns.recentCalls")}
							</p>
						</div>

						{/* Call Cards */}
						{callHistoryLoading ? (
							<div className="text-center py-8">
								{t("campaigns.loadingCallHistory")}
							</div>
						) : callHistory?.data?.length === 0 ? (
							<div className="text-center py-8 text-gray-500">
								{t("campaigns.noCallHistoryForCampaign")}
							</div>
						) : (
							<div className="space-y-3">
								{callHistory?.data?.map((call) => (
									<div
										key={call.id}
										className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
										onClick={() => navigate(`/dashboard/calls/${call.id}`)}
									>
										<div className="flex items-center justify-between mb-4">
											<Badge
												variant={
													call.callStatus === "COMPLETED"
														? "default"
														: call.callStatus === "FAILED"
														? "destructive"
														: "secondary"
												}
												className="text-sm px-3 py-2 font-semibold"
											>
												{t(
													`campaigns.callStatus.${call.callStatus.toLowerCase()}`
												)}
											</Badge>
											<span className="text-sm text-gray-500 font-medium">
												{formatDate(call.callTime)}
											</span>
										</div>
										<div className="space-y-3 text-base text-gray-700">
											<div className="flex items-center">
												<span className="text-gray-500 font-medium min-w-[60px]">
													{t("common.leads")}:
												</span>
												<span className="ml-3 font-medium">
													{call.lead?.name || t("activity.unknownLead")}
												</span>
											</div>
											{call.duration && (
												<div className="flex items-center">
													<span className="text-gray-500 font-medium min-w-[60px]">
														{t("common.duration")}:
													</span>
													<span className="ml-3 font-medium">
														{`${Math.round(call.duration / 60)}${t(
															"activity.minutes"
														)} ${call.duration % 60}${t("activity.seconds")}`}
													</span>
												</div>
											)}
											<div className="flex items-center">
												<span className="text-gray-500 font-medium min-w-[60px]">
													{t("campaigns.transferred")}:
												</span>
												<span className="ml-3 font-medium">
													{call.transferred
														? t("leadDetail.yes")
														: t("leadDetail.no")}
												</span>
											</div>
											{call.notes && (
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mt-3">
													<span className="text-gray-500 text-sm font-medium">
														{t("common.notes")}:
													</span>
													<div className="text-base mt-2 text-gray-700">
														{call.notes.length > 50
															? `${call.notes.substring(0, 50)}...`
															: call.notes}
													</div>
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Add Leads Modal */}
			{showAddLeadsModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg w-full max-w-4xl mx-auto max-h-[90vh] flex flex-col">
						{/* Header */}
						<div className="flex justify-between items-center p-4 sm:p-6 border-b">
							<h2 className="text-lg sm:text-xl font-semibold">
								{t("campaigns.addLeadsToCampaign")}
							</h2>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setShowAddLeadsModal(false);
									setSelectedLeads([]);
								}}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-hidden">
							{availableLeadsError ? (
								<div className="text-center py-8 text-red-500">
									{t("campaigns.errorLoadingLeads")}{" "}
									{availableLeadsError.message}
								</div>
							) : availableLeadsLoading ? (
								<div className="text-center py-8">
									{t("campaigns.loadingAvailableLeads")}
								</div>
							) : availableLeads?.data?.length === 0 ? (
								<div className="text-center py-8">
									<div className="text-gray-500 mb-4">
										{t("campaigns.noAvailableLeadsFound")}
									</div>
								</div>
							) : (
								<div className="p-4 sm:p-6 space-y-4">
									<div className="text-xs sm:text-sm text-gray-600">
										{t("campaigns.selectLeadsToAddToCampaign")}
									</div>

									{/* Scrollable Table Container */}
									<div className="overflow-y-auto max-h-[300px] sm:max-h-[400px] border rounded-lg">
										<Table>
											<TableHeader className="sticky top-0 bg-white z-10">
												<TableRow>
													<TableHead className="w-12">
														<input
															type="checkbox"
															checked={
																selectedLeads.length ===
																availableLeads?.data?.length
															}
															onChange={(e) => {
																if (e.target.checked) {
																	setSelectedLeads(
																		availableLeads?.data?.map(
																			(lead: Lead) => lead.id
																		) || []
																	);
																} else {
																	setSelectedLeads([]);
																}
															}}
														/>
													</TableHead>
													<TableHead className="text-xs sm:text-sm">
														{t("common.name")}
													</TableHead>
													<TableHead className="text-xs sm:text-sm">
														{t("common.phone")}
													</TableHead>
													<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
														{t("common.city")}
													</TableHead>
													<TableHead className="hidden sm:table-cell text-xs sm:text-sm">
														{t("common.date")}
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{availableLeads?.data?.map((lead: Lead) => (
													<TableRow key={lead.id}>
														<TableCell>
															<input
																type="checkbox"
																checked={selectedLeads.includes(lead.id)}
																onChange={(e) =>
																	handleLeadSelection(lead.id, e.target.checked)
																}
															/>
														</TableCell>
														<TableCell className="font-medium text-xs sm:text-sm">
															{lead.name}
														</TableCell>
														<TableCell className="text-xs sm:text-sm">
															{lead.phone1}
														</TableCell>
														<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
															{lead.city || "-"}
														</TableCell>
														<TableCell className="hidden sm:table-cell text-xs sm:text-sm">
															{formatDate(lead.createdAt)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>

									{selectedLeads.length + (campaignData.leads?.length || 0) >
										5 && (
										<Alert variant="destructive">
											<AlertDescription className="text-xs sm:text-sm">
												{t("campaigns.cannotAddMoreThan5")}{" "}
												{campaignData.leads?.length || 0},{" "}
												{t("campaigns.selected")} {selectedLeads.length}
											</AlertDescription>
										</Alert>
									)}
								</div>
							)}
						</div>

						{/* Footer with Static Buttons */}
						<div className="border-t p-4 sm:p-6 bg-gray-50">
							<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
								<div className="text-xs sm:text-sm text-gray-600">
									{t("campaigns.selected")} {selectedLeads.length}{" "}
									{t("campaigns.leads")}
								</div>
								<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
									<Button
										onClick={handleAddLeads}
										disabled={
											selectedLeads.length === 0 ||
											addLeadsToCampaignMutation.isPending ||
											selectedLeads.length + (campaignData.leads?.length || 0) >
												5
										}
										className="text-sm"
									>
										{addLeadsToCampaignMutation.isPending
											? t("campaigns.adding")
											: t("campaigns.addSelectedLeads")}
									</Button>
									<Button
										variant="outline"
										onClick={() => {
											setShowAddLeadsModal(false);
											setSelectedLeads([]);
										}}
										disabled={addLeadsToCampaignMutation.isPending}
										className="text-sm"
									>
										{t("common.cancel")}
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Stop Campaign Confirmation Modal */}
			{showStopCampaignModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg w-full max-w-md mx-auto">
						{/* Header */}
						<div className="flex justify-between items-center p-4 sm:p-6 border-b">
							<h2 className="text-lg sm:text-xl font-semibold text-red-600">
								{t("campaigns.stopCampaign")}
							</h2>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleCancelStopCampaign}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						{/* Content */}
						<div className="p-4 sm:p-6">
							<div className="space-y-4">
								<div className="flex items-start space-x-3">
									<div className="flex-shrink-0 mt-1">
										<div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
											<Square className="h-4 w-4 text-red-600" />
										</div>
									</div>
									<div className="flex-1">
										<h3 className="text-base sm:text-lg font-medium text-gray-900">
											{t("campaigns.stopCampaignWarning")}
										</h3>
										<p className="text-xs sm:text-sm text-gray-600 mt-2">
											{t("campaigns.stopCampaignDescription")}
										</p>
									</div>
								</div>

								<Alert variant="destructive">
									<AlertDescription className="text-xs sm:text-sm">
										{t("campaigns.stopCampaignAlert")}
									</AlertDescription>
								</Alert>
							</div>
						</div>

						{/* Footer */}
						<div className="border-t p-4 sm:p-6 bg-gray-50">
							<div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
								<Button
									variant="outline"
									onClick={handleCancelStopCampaign}
									disabled={stopCampaignMutation.isPending}
									className="text-sm"
								>
									{t("common.cancel")}
								</Button>
								<Button
									variant="destructive"
									onClick={handleConfirmStopCampaign}
									disabled={stopCampaignMutation.isPending}
									className="text-sm"
								>
									{stopCampaignMutation.isPending ? (
										<>
											<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
											{t("campaigns.stopping")}
										</>
									) : (
										<>
											<Square className="h-4 w-4 mr-2" />
											{t("campaigns.stopCampaign")}
										</>
									)}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Error Alerts */}
			{(startCampaignMutation.isError ||
				stopCampaignMutation.isError ||
				deleteCampaignMutation.isError ||
				addLeadsToCampaignMutation.isError ||
				removeLeadFromCampaignMutation.isError ||
				cleanupOrphanedLeadsMutation.isError) && (
				<Alert variant="destructive">
					<AlertDescription className="text-xs sm:text-sm">
						{t("errors.failedToUpdateCampaign")}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
