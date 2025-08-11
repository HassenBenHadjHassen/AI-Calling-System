"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Switch } from "@radix-ui/react-switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Square, Plus, Trash2, Users, X } from "lucide-react";
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
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { socketService } from "~/lib/socket";
import {
	campaignAPI,
	type Campaign,
	type CreateCampaignRequest,
} from "~/services/api";
import { formatDate } from "~/lib/utils";
import { useToast } from "~/components/ui/toast";

export default function CampaignPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { addToast } = useToast();
	const [showCleanWarning, setShowCleanWarning] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newCampaignName, setNewCampaignName] = useState("");

	// Move all hooks to the top, before any conditional logic
	const { data: campaigns, isLoading } = useQuery({
		queryKey: ["campaigns"],
		queryFn: () => campaignAPI.getCampaigns(),
		enabled: isAuthenticated, // Only run when authenticated
		refetchInterval: 5000, // Refresh every 5 seconds to catch new campaigns
	});

	const { data: activeCampaigns } = useQuery({
		queryKey: ["active-campaigns"],
		queryFn: () => campaignAPI.getAllActiveCampaigns(),
		enabled: isAuthenticated, // Only run when authenticated
		refetchInterval: 5000, // Refresh every 5 seconds
	});

	const createCampaignMutation = useMutation({
		mutationFn: (campaign: CreateCampaignRequest) =>
			campaignAPI.createCampaign(campaign),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
			queryClient.invalidateQueries({
				queryKey: ["active-campaigns-overview"],
			});
			setShowCreateModal(false);
			setNewCampaignName("");
			addToast(t("campaigns.campaignCreatedSuccessfully"), "success");
		},
		onError: (error: any) => {
			// Handle duplicate name error
			if (error?.error?.includes("already exists")) {
				addToast(error.error, "error");
			} else {
				addToast(t("campaigns.failedToCreateCampaign"), "error");
			}
		},
	});

	const startCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.startCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
			queryClient.invalidateQueries({
				queryKey: ["active-campaigns-overview"],
			});
		},
	});

	const stopCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.stopCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
			queryClient.invalidateQueries({
				queryKey: ["active-campaigns-overview"],
			});
		},
	});

	const cleanAllCampaignsMutation = useMutation({
		mutationFn: () => campaignAPI.cleanAllCampaigns(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
			queryClient.invalidateQueries({
				queryKey: ["active-campaigns-overview"],
			});
			setShowCleanWarning(false);
		},
	});

	const deleteCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.deleteCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
			queryClient.invalidateQueries({
				queryKey: ["active-campaigns-overview"],
			});
		},
	});

	// Now handle effects and conditional logic
	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	useEffect(() => {
		if (isAuthenticated && isClient) {
			// Connect to socket when dashboard loads
			socketService.connect();

			const socket = socketService.getSocket();
			if (socket) {
				// Listen for real-time campaign updates
				socket.on("campaign-created", (data) => {
					console.log("Campaign created:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaign-started", (data) => {
					console.log("Campaign started:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaign-stopped", (data) => {
					console.log("Campaign stopped:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaign-completed", (data) => {
					console.log("Campaign completed:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaign-deleted", (data) => {
					console.log("Campaign deleted:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaign-leads-added", (data) => {
					console.log("Leads added to campaign:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaign-lead-removed", (data) => {
					console.log("Lead removed from campaign:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				socket.on("campaigns-cleaned", (data) => {
					console.log("All campaigns cleaned:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});

				// Listen for leads uploaded event to refresh campaign data
				socket.on("leads-uploaded", (data) => {
					console.log("Leads uploaded, refreshing campaigns:", data);
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				});
			}

			return () => {
				if (socket) {
					socket.off("campaign-created");
					socket.off("campaign-started");
					socket.off("campaign-stopped");
					socket.off("campaign-completed");
					socket.off("campaign-deleted");
					socket.off("campaign-leads-added");
					socket.off("campaign-lead-removed");
					socket.off("campaigns-cleaned");
					socket.off("leads-uploaded");
				}
				socketService.disconnect();
			};
		}
	}, [isAuthenticated, isClient, queryClient]);

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

	const handleToggleCampaign = (campaign: Campaign) => {
		if (campaign.status === "ACTIVE") {
			stopCampaignMutation.mutate(campaign.id);
		} else {
			startCampaignMutation.mutate(campaign.id);
		}
	};

	const handleCleanAllCampaigns = () => {
		setShowCleanWarning(true);
	};

	const confirmCleanAllCampaigns = () => {
		cleanAllCampaignsMutation.mutate();
	};

	const handleCreateCampaign = () => {
		const trimmedName = newCampaignName.trim();
		if (!trimmedName) {
			addToast(t("campaigns.campaignNameRequired"), "error");
			return;
		}

		// Check if campaign name already exists in current campaigns
		const existingCampaign = campaigns?.data?.find(
			(campaign) => campaign.name.toLowerCase() === trimmedName.toLowerCase()
		);

		if (existingCampaign) {
			addToast(t("campaigns.campaignNameAlreadyExists"), "error");
			return;
		}

		createCampaignMutation.mutate({ name: trimmedName });
	};

	const handleDeleteCampaign = (campaignId: string) => {
		if (confirm(t("campaigns.confirmDeleteCampaign"))) {
			deleteCampaignMutation.mutate(campaignId);
		}
	};

	const handleOpenCreateModal = () => {
		setShowCreateModal(true);
	};

	const handleCloseCreateModal = () => {
		setShowCreateModal(false);
		setNewCampaignName("");
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

	return (
		<div className="flex h-screen bg-gray-100">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-3 sm:p-6">
					<div className="space-y-4 sm:space-y-6">
						<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
							<div>
								<h1 className="text-xl sm:text-2xl font-bold text-gray-900">
									{t("campaigns.title")}
								</h1>
								<p className="text-gray-600 text-sm sm:text-base">
									{t("campaigns.description")}
								</p>
							</div>
							<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
								<Button onClick={handleOpenCreateModal} className="text-sm">
									<Plus className="h-4 w-4 mr-2" />
									{t("campaigns.newCampaign")}
								</Button>
								<Button
									variant="destructive"
									onClick={handleCleanAllCampaigns}
									disabled={cleanAllCampaignsMutation.isPending}
									className="text-sm"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									{t("campaigns.cleanAllCampaigns")}
								</Button>
							</div>
						</div>

						{/* Create Campaign Modal */}
						{showCreateModal && (
							<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
								<div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-auto">
									<div className="flex justify-between items-center mb-4">
										<h2 className="text-lg sm:text-xl font-semibold">
											{t("campaigns.createNewCampaign")}
										</h2>
										<Button
											variant="ghost"
											size="sm"
											onClick={handleCloseCreateModal}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
									<div className="space-y-4">
										<div>
											<div className="text-xs sm:text-sm font-medium mb-2">
												{t("campaigns.campaignName")}
											</div>
											<Input
												id="campaign-name"
												value={newCampaignName}
												onChange={(e) => setNewCampaignName(e.target.value)}
												placeholder={t("campaigns.enterCampaignName")}
												onKeyPress={(e) => {
													if (e.key === "Enter") {
														handleCreateCampaign();
													}
												}}
												className={
													campaigns?.data?.find(
														(campaign) =>
															campaign.name.toLowerCase() ===
															newCampaignName.trim().toLowerCase()
													) !== undefined
														? "border-red-500 focus:border-red-500"
														: ""
												}
											/>
											{campaigns?.data?.find(
												(campaign) =>
													campaign.name.toLowerCase() ===
													newCampaignName.trim().toLowerCase()
											) !== undefined && (
												<p className="text-xs sm:text-sm text-red-600 mt-1">
													{t("campaigns.campaignNameAlreadyExists")}
												</p>
											)}
										</div>
										<div className="text-xs sm:text-sm text-gray-600">
											{t("campaigns.addLeadsNote")}
										</div>
										<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
											<Button
												onClick={handleCreateCampaign}
												disabled={
													!newCampaignName.trim() ||
													createCampaignMutation.isPending ||
													campaigns?.data?.find(
														(campaign) =>
															campaign.name.toLowerCase() ===
															newCampaignName.trim().toLowerCase()
													) !== undefined
												}
												className="flex-1 text-sm"
											>
												{createCampaignMutation.isPending
													? t("campaigns.creating")
													: t("campaigns.createCampaign")}
											</Button>
											<Button
												variant="outline"
												onClick={handleCloseCreateModal}
												disabled={createCampaignMutation.isPending}
												className="text-sm"
											>
												{t("common.cancel")}
											</Button>
										</div>
									</div>
								</div>
							</div>
						)}

						{showCleanWarning && (
							<Card className="border-red-200 bg-red-50">
								<CardHeader>
									<CardTitle className="text-red-800 text-lg sm:text-xl">
										{t("campaigns.warning")}
									</CardTitle>
									<CardContent className="text-red-700">
										<p className="mb-4 text-sm">
											{t("campaigns.confirmDeleteAllCampaigns")}
										</p>
										<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
											<Button
												variant="destructive"
												onClick={confirmCleanAllCampaigns}
												disabled={cleanAllCampaignsMutation.isPending}
												className="text-sm"
											>
												{cleanAllCampaignsMutation.isPending
													? t("common.loading")
													: t("campaigns.yesDeleteAll")}
											</Button>
											<Button
												variant="outline"
												onClick={() => setShowCleanWarning(false)}
												disabled={cleanAllCampaignsMutation.isPending}
												className="text-sm"
											>
												{t("common.cancel")}
											</Button>
										</div>
									</CardContent>
								</CardHeader>
							</Card>
						)}

						{activeCampaigns?.data && activeCampaigns.data.length > 0 && (
							<Card className="border-green-200 bg-green-50">
								<CardHeader>
									<CardTitle className="text-green-800 text-lg sm:text-xl">
										{t("campaigns.activeCampaignsCount")} (
										{activeCampaigns.data.length})
									</CardTitle>
									<CardDescription className="text-green-600 text-sm">
										{t("campaigns.currentlyRunning")}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{activeCampaigns.data.map((campaign) => (
											<div
												key={campaign.id}
												className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-green-200 rounded-lg bg-white space-y-4 sm:space-y-0"
											>
												<div>
													<h3 className="font-semibold text-base sm:text-lg">
														{campaign.name}
													</h3>
													<p className="text-xs sm:text-sm text-gray-600">
														ID: {campaign.id}
													</p>
													<p className="text-xs sm:text-sm text-gray-600">
														{t("campaigns.started")}{" "}
														{campaign.startedAt
															? formatDate(campaign.startedAt) ?? ""
															: ""}
													</p>
													<p className="text-xs sm:text-sm text-gray-600">
														{t("dashboard.totalLeads")}:{" "}
														{campaign.leads?.length || 0}
													</p>
												</div>
												<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
													<Badge variant="default" className="text-xs">
														{t("campaigns.active")}
													</Badge>
													<Button
														variant="destructive"
														onClick={() => handleToggleCampaign(campaign)}
														disabled={stopCampaignMutation.isPending}
														className="text-sm"
													>
														<Square className="h-4 w-4 mr-2" />
														{t("campaigns.stopCampaign")}
													</Button>
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}

						<Card>
							<CardHeader>
								<CardTitle className="text-lg sm:text-xl">
									{t("campaigns.allCampaigns")}
								</CardTitle>
								<CardDescription className="text-sm">
									{t("campaigns.manageCampaigns")}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="text-center py-8">{t("common.loading")}</div>
								) : campaigns?.data?.length === 0 ? (
									<div className="text-center py-8 text-gray-500">
										{t("campaigns.noCampaigns")}
									</div>
								) : (
									<div className="space-y-4">
										{campaigns?.data?.map((campaign) => (
											<div
												key={campaign.id}
												className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg space-y-4 sm:space-y-0"
											>
												<div className="flex-1">
													<div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
														<h3 className="font-semibold text-base sm:text-lg">
															{campaign.name}
														</h3>
														<Badge
															variant={getStatusColor(campaign.status) as any}
															className="text-xs w-fit"
														>
															{t(`status.${campaign.status.toLowerCase()}`)}
														</Badge>
													</div>
													<div className="mt-2 sm:mt-1 text-xs sm:text-sm text-gray-600 space-y-1">
														<p
															className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors break-all"
															onClick={() => {
																navigator.clipboard.writeText(campaign.id);
																addToast(
																	t("campaigns.idCopiedToClipboard"),
																	"success"
																);
															}}
															title="Click to copy ID"
														>
															ID: {campaign.id}
														</p>
														<p>
															{t("campaigns.started")}{" "}
															{campaign.startedAt
																? formatDate(campaign.startedAt) ?? ""
																: t("campaigns.notStarted")}
														</p>
														<p>
															{t("campaigns.stopped")}{" "}
															{campaign.stoppedAt
																? formatDate(campaign.stoppedAt)
																: t("campaigns.notStopped")}
														</p>
														<div className="flex items-center">
															<Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
															<span>
																{campaign.leads?.length || 0}{" "}
																{t("nav.leads").toLowerCase()}
															</span>
															{campaign.leads?.length === 0 && (
																<Badge
																	variant="secondary"
																	className="ml-2 text-xs"
																>
																	No leads
																</Badge>
															)}
														</div>
													</div>
												</div>

												<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
													<div className="flex items-center space-x-2">
														<span className="text-xs sm:text-sm">
															{campaign.status === "ACTIVE"
																? t("campaigns.running")
																: t("status.stopped")}
														</span>
														<Switch
															checked={campaign.status === "ACTIVE"}
															onCheckedChange={() =>
																handleToggleCampaign(campaign)
															}
															disabled={
																startCampaignMutation.isPending ||
																stopCampaignMutation.isPending
															}
														/>
													</div>

													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															navigate(`/dashboard/campaign/${campaign.id}`)
														}
														className="text-xs sm:text-sm"
													>
														{t("campaigns.viewDetails")}
													</Button>

													<Button
														variant="ghost"
														size="sm"
														className="text-red-600 hover:text-red-700"
														onClick={() => handleDeleteCampaign(campaign.id)}
														disabled={deleteCampaignMutation.isPending}
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

						{(startCampaignMutation.isError ||
							stopCampaignMutation.isError ||
							createCampaignMutation.isError ||
							deleteCampaignMutation.isError) && (
							<Alert variant="destructive">
								<AlertDescription className="text-sm">
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
