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

	const resetLeadsForTestingMutation = useMutation({
		mutationFn: () => leadAPI.resetLeadsForTesting(),
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

	if (campaignLoading) {
		return (
			<div className="flex h-screen bg-gray-100">
				<Sidebar />
				<div className="flex-1 flex flex-col overflow-hidden">
					<Topbar />
					<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
						<div className="text-center py-8">
							{t("campaigns.loadingCampaignDetails")}
						</div>
					</main>
				</div>
			</div>
		);
	}

	if (!campaign?.data) {
		return (
			<div className="flex h-screen bg-gray-100">
				<Sidebar />
				<div className="flex-1 flex flex-col overflow-hidden">
					<Topbar />
					<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
						<Alert variant="destructive">
							<AlertDescription>
								{t("campaigns.campaignNotFound")}
							</AlertDescription>
						</Alert>
					</main>
				</div>
			</div>
		);
	}

	const campaignData = campaign.data;

	return (
		<div className="flex h-screen bg-gray-100">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
					<div className="space-y-6">
						{/* Header */}
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-4">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => navigate("/dashboard/campaign")}
								>
									<ArrowLeft className="h-4 w-4 mr-2" />
									{t("campaigns.backToCampaigns")}
								</Button>
								<div>
									<h1 className="text-2xl font-bold text-gray-900">
										{campaignData.name}
									</h1>
									<p className="text-gray-600">
										{t("campaigns.campaignDetails")}
									</p>
								</div>
							</div>
							<div className="flex items-center space-x-2">
								<Badge variant={getStatusColor(campaignData.status) as any}>
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

						{/* Campaign Overview */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										{t("campaigns.campaignInfo")}
									</CardTitle>
									<Calendar className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-sm text-gray-600">ID</span>
											<span
												className="text-sm font-mono cursor-pointer hover:text-blue-600 transition-colors"
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
											<span className="text-sm text-gray-600">
												{t("campaigns.started")}
											</span>
											<span className="text-sm">
												{campaignData.startedAt
													? formatDate(campaignData.startedAt)
													: t("campaigns.notStarted")}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-gray-600">
												{t("campaigns.stopped")}
											</span>
											<span className="text-sm">
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
									<CardTitle className="text-sm font-medium">
										{t("common.leads")}
									</CardTitle>
									<Users className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{campaignData.leads?.length || 0}
									</div>
									<p className="text-xs text-muted-foreground">
										{t("campaigns.totalLeadsInCampaign")}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										{t("campaigns.callStats")}
									</CardTitle>
									<BarChart3 className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									{statsLoading ? (
										<div className="text-sm">{t("campaigns.loadingStats")}</div>
									) : (
										<div className="space-y-1">
											<div className="flex justify-between text-sm">
												<span>{t("campaigns.total")}</span>
												<span>{callStats?.data?.total || 0}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span>{t("campaigns.completed")}</span>
												<span>{callStats?.data?.completed || 0}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span>{t("campaigns.failed")}</span>
												<span>{callStats?.data?.failed || 0}</span>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						{/* Leads Section */}
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>{t("campaigns.campaignLeads")}</CardTitle>
										<CardDescription>
											{t("campaigns.allLeadsAssociated")}
										</CardDescription>
									</div>
									<Button
										onClick={() => setShowAddLeadsModal(true)}
										disabled={campaignData.status === "COMPLETED"}
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
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>{t("common.name")}</TableHead>
													<TableHead>{t("common.phone")}</TableHead>
													<TableHead>{t("common.status")}</TableHead>
													<TableHead>{t("common.city")}</TableHead>
													<TableHead>{t("common.date")}</TableHead>
													<TableHead>{t("common.actions")}</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{campaignData.leads?.map((lead) => (
													<TableRow key={lead.id}>
														<TableCell className="font-medium">
															{lead.name}
														</TableCell>
														<TableCell>{lead.phone1}</TableCell>
														<TableCell>
															<Badge
																variant={getLeadStatusColor(lead.status) as any}
															>
																{t(`leads.${lead.status.toLowerCase()}`)}
															</Badge>
														</TableCell>
														<TableCell>{lead.city || "-"}</TableCell>
														<TableCell>{formatDate(lead.createdAt)}</TableCell>
														<TableCell>
															<div className="flex items-center space-x-2">
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() =>
																		navigate(`/dashboard/leads/${lead.id}`)
																	}
																>
																	{t("campaigns.viewDetails")}
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	className="text-red-600 hover:text-red-700"
																	onClick={() => handleRemoveLead(lead.id)}
																	disabled={
																		removeLeadFromCampaignMutation.isPending
																	}
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Call History Section */}
						<Card>
							<CardHeader>
								<CardTitle>{t("leadDetail.callHistory")}</CardTitle>
								<CardDescription>{t("campaigns.recentCalls")}</CardDescription>
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
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>{t("common.leads")}</TableHead>
													<TableHead>{t("common.status")}</TableHead>
													<TableHead>{t("common.duration")}</TableHead>
													<TableHead>{t("campaigns.transferred")}</TableHead>
													<TableHead>{t("campaigns.callTime")}</TableHead>
													<TableHead>{t("common.notes")}</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{callHistory?.data?.map((call) => (
													<TableRow key={call.id}>
														<TableCell className="font-medium">
															{call.lead?.name || t("activity.unknownLead")}
														</TableCell>
														<TableCell>
															<Badge
																variant={
																	getCallStatusColor(call.callStatus) as any
																}
															>
																{t(
																	`campaigns.callStatus.${call.callStatus.toLowerCase()}`
																)}
															</Badge>
														</TableCell>
														<TableCell>
															{call.duration
																? `${Math.round(call.duration / 60)}${t(
																		"activity.minutes"
																  )} ${call.duration % 60}${t(
																		"activity.seconds"
																  )}`
																: "-"}
														</TableCell>
														<TableCell>
															{call.transferred
																? t("leadDetail.yes")
																: t("leadDetail.no")}
														</TableCell>
														<TableCell>{formatDate(call.callTime)}</TableCell>
														<TableCell>
															{call.notes || t("activity.noNotes")}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Add Leads Modal */}
						{showAddLeadsModal && (
							<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
								<div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
									{/* Header */}
									<div className="flex justify-between items-center p-6 border-b">
										<h2 className="text-xl font-semibold">
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
											<div className="p-6 space-y-4">
												<div className="text-sm text-gray-600">
													{t("campaigns.selectLeadsToAddToCampaign")}
												</div>

												{/* Scrollable Table Container */}
												<div className="overflow-y-auto max-h-[400px] border rounded-lg">
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
																<TableHead>{t("common.name")}</TableHead>
																<TableHead>{t("common.phone")}</TableHead>
																<TableHead>{t("common.city")}</TableHead>
																<TableHead>{t("common.date")}</TableHead>
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
																	<TableCell className="font-medium">
																		{lead.name}
																	</TableCell>
																	<TableCell>{lead.phone1}</TableCell>
																	<TableCell>{lead.city || "-"}</TableCell>
																	<TableCell>
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
														<AlertDescription>
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
									<div className="border-t p-6 bg-gray-50">
										<div className="flex justify-between items-center">
											<div className="text-sm text-gray-600">
												{t("campaigns.selected")} {selectedLeads.length}{" "}
												{t("campaigns.leads")}
											</div>
											<div className="flex space-x-2">
												<Button
													onClick={handleAddLeads}
													disabled={
														selectedLeads.length === 0 ||
														addLeadsToCampaignMutation.isPending ||
														selectedLeads.length +
															(campaignData.leads?.length || 0) >
															5
													}
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
							<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
								<div className="bg-white rounded-lg w-full max-w-md mx-4">
									{/* Header */}
									<div className="flex justify-between items-center p-6 border-b">
										<h2 className="text-xl font-semibold text-red-600">
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
									<div className="p-6">
										<div className="space-y-4">
											<div className="flex items-start space-x-3">
												<div className="flex-shrink-0 mt-1">
													<div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
														<Square className="h-4 w-4 text-red-600" />
													</div>
												</div>
												<div className="flex-1">
													<h3 className="text-lg font-medium text-gray-900">
														{t("campaigns.stopCampaignWarning")}
													</h3>
													<p className="text-sm text-gray-600 mt-2">
														{t("campaigns.stopCampaignDescription")}
													</p>
												</div>
											</div>

											<Alert variant="destructive">
												<AlertDescription>
													{t("campaigns.stopCampaignAlert")}
												</AlertDescription>
											</Alert>
										</div>
									</div>

									{/* Footer */}
									<div className="border-t p-6 bg-gray-50">
										<div className="flex justify-end space-x-3">
											<Button
												variant="outline"
												onClick={handleCancelStopCampaign}
												disabled={stopCampaignMutation.isPending}
											>
												{t("common.cancel")}
											</Button>
											<Button
												variant="destructive"
												onClick={handleConfirmStopCampaign}
												disabled={stopCampaignMutation.isPending}
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
								<AlertDescription>
									{t("errors.failedToUpdateCampaign")}
								</AlertDescription>
							</Alert>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
