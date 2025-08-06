"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Switch } from "@radix-ui/react-switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function CampaignPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const queryClient = useQueryClient();
	const [showCleanWarning, setShowCleanWarning] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newCampaignName, setNewCampaignName] = useState("");

	// Move all hooks to the top, before any conditional logic
	const { data: campaigns, isLoading } = useQuery({
		queryKey: ["campaigns"],
		queryFn: () => campaignAPI.getCampaigns(),
		enabled: isAuthenticated, // Only run when authenticated
	});

	const { data: activeCampaign } = useQuery({
		queryKey: ["active-campaign"],
		queryFn: () => campaignAPI.getActiveCampaign(),
		enabled: isAuthenticated, // Only run when authenticated
	});

	const createCampaignMutation = useMutation({
		mutationFn: (campaign: CreateCampaignRequest) =>
			campaignAPI.createCampaign(campaign),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			setShowCreateModal(false);
			setNewCampaignName("");
		},
	});

	const startCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.startCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign-overview"] });
		},
	});

	const stopCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.stopCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign-overview"] });
		},
	});

	const cleanAllCampaignsMutation = useMutation({
		mutationFn: () => campaignAPI.cleanAllCampaigns(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign-overview"] });
			setShowCleanWarning(false);
		},
	});

	const deleteCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.deleteCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign-overview"] });
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
		if (newCampaignName.trim()) {
			createCampaignMutation.mutate({ name: newCampaignName.trim() });
		}
	};

	const handleDeleteCampaign = (campaignId: string) => {
		if (
			confirm(
				"Are you sure you want to delete this campaign? This action cannot be undone."
			)
		) {
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
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
					<div className="space-y-6">
						<div className="flex justify-between items-center">
							<div>
								<h1 className="text-2xl font-bold text-gray-900">
									Campaign Management
								</h1>
								<p className="text-gray-600">
									Start, stop, and monitor your calling campaigns
								</p>
							</div>
							<div className="flex space-x-2">
								{/* <Button onClick={handleOpenCreateModal}>
									<Plus className="h-4 w-4 mr-2" />
									New Campaign
								</Button> */}
								<Button
									variant="destructive"
									onClick={handleCleanAllCampaigns}
									disabled={cleanAllCampaignsMutation.isPending}
								>
									<Trash2 className="h-4 w-4 mr-2" />
									Clean All Campaigns
								</Button>
							</div>
						</div>

						{/* Create Campaign Modal */}
						{showCreateModal && (
							<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
								<div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
									<div className="flex justify-between items-center mb-4">
										<h2 className="text-xl font-semibold">
											Create New Campaign
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
											<div className="text-sm font-medium mb-2">
												Campaign Name
											</div>
											<Input
												id="campaign-name"
												value={newCampaignName}
												onChange={(e) => setNewCampaignName(e.target.value)}
												placeholder="Enter campaign name"
												onKeyPress={(e) => {
													if (e.key === "Enter") {
														handleCreateCampaign();
													}
												}}
											/>
										</div>
										<div className="text-sm text-gray-600">
											Note: You can add leads to this campaign after creation by
											clicking "View Details" and then "Add Leads".
										</div>
										<div className="flex space-x-2">
											<Button
												onClick={handleCreateCampaign}
												disabled={
													!newCampaignName.trim() ||
													createCampaignMutation.isPending
												}
												className="flex-1"
											>
												{createCampaignMutation.isPending
													? "Creating..."
													: "Create Campaign"}
											</Button>
											<Button
												variant="outline"
												onClick={handleCloseCreateModal}
												disabled={createCampaignMutation.isPending}
											>
												Cancel
											</Button>
										</div>
									</div>
								</div>
							</div>
						)}

						{showCleanWarning && (
							<Card className="border-red-200 bg-red-50">
								<CardHeader>
									<CardTitle className="text-red-800">⚠️ Warning</CardTitle>
									<CardContent className="text-red-700">
										<p className="mb-4">
											Are you sure you want to delete ALL campaigns? This action
											cannot be undone.
										</p>
										<div className="flex space-x-2">
											<Button
												variant="destructive"
												onClick={confirmCleanAllCampaigns}
												disabled={cleanAllCampaignsMutation.isPending}
											>
												{cleanAllCampaignsMutation.isPending
													? "Deleting..."
													: "Yes, Delete All"}
											</Button>
											<Button
												variant="outline"
												onClick={() => setShowCleanWarning(false)}
												disabled={cleanAllCampaignsMutation.isPending}
											>
												Cancel
											</Button>
										</div>
									</CardContent>
								</CardHeader>
							</Card>
						)}

						{activeCampaign?.data && (
							<Card className="border-green-200 bg-green-50">
								<CardHeader>
									<CardTitle className="text-green-800">
										Active Campaign
									</CardTitle>
									<CardDescription className="text-green-600">
										Currently running campaign
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex items-center justify-between">
										<div>
											<h3 className="font-semibold text-lg">
												{activeCampaign.data.name}
											</h3>
											<p className="text-sm text-gray-600">
												Started:{" "}
												{activeCampaign.data.startedAt
													? formatDate(activeCampaign.data.startedAt) ?? ""
													: ""}
											</p>
											<p className="text-sm text-gray-600">
												Leads: {activeCampaign.data.leads?.length || 0}
											</p>
										</div>
										<div className="flex items-center space-x-4">
											<Badge variant="default">ACTIVE</Badge>
											<Button
												variant="destructive"
												onClick={() =>
													handleToggleCampaign(activeCampaign.data)
												}
												disabled={stopCampaignMutation.isPending}
											>
												<Square className="h-4 w-4 mr-2" />
												Stop Campaign
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						<Card>
							<CardHeader>
								<CardTitle>All Campaigns</CardTitle>
								<CardDescription>Manage your calling campaigns</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="text-center py-8">Loading campaigns...</div>
								) : campaigns?.data?.length === 0 ? (
									<div className="text-center py-8 text-gray-500">
										No campaigns found. Create your first campaign to get
										started.
									</div>
								) : (
									<div className="space-y-4">
										{campaigns?.data?.map((campaign) => (
											<div
												key={campaign.id}
												className="flex items-center justify-between p-4 border rounded-lg"
											>
												<div className="flex-1">
													<div className="flex items-center space-x-3">
														<h3 className="font-semibold">{campaign.name}</h3>
														<Badge
															variant={getStatusColor(campaign.status) as any}
														>
															{campaign.status}
														</Badge>
													</div>
													<div className="mt-1 text-sm text-gray-600 space-y-1">
														<p>
															Started:{" "}
															{campaign.startedAt
																? formatDate(campaign.startedAt) ?? ""
																: ""}
														</p>
														<p>
															Stopped:{" "}
															{campaign.stoppedAt
																? formatDate(campaign.stoppedAt)
																: ""}
														</p>
														<div className="flex items-center">
															<Users className="h-4 w-4 mr-1" />
															<span>{campaign.leads?.length || 0} leads</span>
															{campaign.leads?.length === 0 && (
																<Badge variant="secondary" className="ml-2">
																	No leads
																</Badge>
															)}
														</div>
													</div>
												</div>

												<div className="flex items-center space-x-4">
													<div className="flex items-center space-x-2">
														<span className="text-sm">
															{campaign.status === "ACTIVE"
																? "Running"
																: "Stopped"}
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
													>
														View Details
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
								<AlertDescription>
									Failed to update campaign status. Please try again.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
