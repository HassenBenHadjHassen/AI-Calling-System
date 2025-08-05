"use client";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { socketService } from "~/lib/socket";
import {
	campaignAPI,
	callAPI,
	leadAPI,
	type Campaign,
	type Lead,
	type CallHistory,
} from "~/services/api";
import { formatDate } from "~/lib/utils";

export default function CampaignDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const queryClient = useQueryClient();
	const [showAddLeadsModal, setShowAddLeadsModal] = useState(false);
	const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

	// Queries
	const { data: campaign, isLoading: campaignLoading } = useQuery({
		queryKey: ["campaign", id],
		queryFn: () => campaignAPI.getCampaign(id!),
		enabled: isAuthenticated && !!id,
	});

	const { data: callHistory, isLoading: callHistoryLoading } = useQuery({
		queryKey: ["campaign-calls", id],
		queryFn: () => callAPI.getCallHistory({ campaignId: id! }),
		enabled: isAuthenticated && !!id,
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

	// Debug logging
	useEffect(() => {
		if (showAddLeadsModal) {
			console.log("Modal opened, availableLeads:", availableLeads);
			console.log("availableLeadsLoading:", availableLeadsLoading);
			console.log("availableLeadsError:", availableLeadsError);
		}
	}, [
		showAddLeadsModal,
		availableLeads,
		availableLeadsLoading,
		availableLeadsError,
	]);

	// Mutations
	const startCampaignMutation = useMutation({
		mutationFn: (campaignId: string) => campaignAPI.startCampaign(campaignId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaign", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
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
		},
	});

	// Effects
	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	useEffect(() => {
		if (isAuthenticated && isClient) {
			socketService.connect();
			return () => {
				socketService.disconnect();
			};
		}
	}, [isAuthenticated, isClient]);

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
			stopCampaignMutation.mutate(campaign.data.id);
		} else {
			startCampaignMutation.mutate(campaign.data.id);
		}
	};

	const handleDeleteCampaign = () => {
		if (!campaign?.data) return;

		if (
			confirm(
				"Are you sure you want to delete this campaign? This action cannot be undone."
			)
		) {
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
		if (
			confirm("Are you sure you want to remove this lead from the campaign?")
		) {
			removeLeadFromCampaignMutation.mutate(leadId);
		}
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
						<div className="text-center py-8">Loading campaign details...</div>
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
							<AlertDescription>Campaign not found</AlertDescription>
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
									Back to Campaigns
								</Button>
								<div>
									<h1 className="text-2xl font-bold text-gray-900">
										{campaignData.name}
									</h1>
									<p className="text-gray-600">Campaign Details</p>
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
											Stop Campaign
										</>
									) : (
										<>
											<Play className="h-4 w-4 mr-2" />
											Start Campaign
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
										Campaign Info
									</CardTitle>
									<Calendar className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-sm text-gray-600">Started:</span>
											<span className="text-sm">
												{campaignData.startedAt
													? formatDate(campaignData.startedAt)
													: "Not started"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-gray-600">Stopped:</span>
											<span className="text-sm">
												{campaignData.stoppedAt
													? formatDate(campaignData.stoppedAt)
													: "Not stopped"}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">Leads</CardTitle>
									<Users className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{campaignData.leads?.length || 0}
									</div>
									<p className="text-xs text-muted-foreground">
										Total leads in campaign
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Call Stats
									</CardTitle>
									<BarChart3 className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									{statsLoading ? (
										<div className="text-sm">Loading stats...</div>
									) : (
										<div className="space-y-1">
											<div className="flex justify-between text-sm">
												<span>Total:</span>
												<span>{callStats?.data?.total || 0}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span>Completed:</span>
												<span>{callStats?.data?.completed || 0}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span>Failed:</span>
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
										<CardTitle>Campaign Leads</CardTitle>
										<CardDescription>
											All leads associated with this campaign
										</CardDescription>
									</div>
									<Button
										onClick={() => setShowAddLeadsModal(true)}
										disabled={campaignData.status === "COMPLETED"}
									>
										<Plus className="h-4 w-4 mr-2" />
										Add Leads
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								{campaignData.leads?.length === 0 ? (
									<div className="text-center py-8 text-gray-500">
										No leads found in this campaign. Click "Add Leads" to add
										leads to this campaign.
									</div>
								) : (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Name</TableHead>
													<TableHead>Phone</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>City</TableHead>
													<TableHead>Created</TableHead>
													<TableHead>Actions</TableHead>
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
																{lead.status}
															</Badge>
														</TableCell>
														<TableCell>{lead.city || "-"}</TableCell>
														<TableCell>{formatDate(lead.createdAt)}</TableCell>
														<TableCell>
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
								<CardTitle>Call History</CardTitle>
								<CardDescription>
									Recent calls made for this campaign
								</CardDescription>
							</CardHeader>
							<CardContent>
								{callHistoryLoading ? (
									<div className="text-center py-8">
										Loading call history...
									</div>
								) : callHistory?.data?.length === 0 ? (
									<div className="text-center py-8 text-gray-500">
										No call history found for this campaign.
									</div>
								) : (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Lead</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>Duration</TableHead>
													<TableHead>Transferred</TableHead>
													<TableHead>Call Time</TableHead>
													<TableHead>Notes</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{callHistory?.data?.map((call) => (
													<TableRow key={call.id}>
														<TableCell className="font-medium">
															{call.lead?.name || "Unknown"}
														</TableCell>
														<TableCell>
															<Badge
																variant={
																	getCallStatusColor(call.callStatus) as any
																}
															>
																{call.callStatus}
															</Badge>
														</TableCell>
														<TableCell>
															{call.duration
																? `${Math.round(call.duration / 60)}m ${
																		call.duration % 60
																  }s`
																: "-"}
														</TableCell>
														<TableCell>
															{call.transferred ? "Yes" : "No"}
														</TableCell>
														<TableCell>{formatDate(call.callTime)}</TableCell>
														<TableCell>{call.notes || "-"}</TableCell>
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
								<div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
									<div className="flex justify-between items-center mb-4">
										<h2 className="text-xl font-semibold">
											Add Leads to Campaign
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

									{availableLeadsError ? (
										<div className="text-center py-8 text-red-500">
											Error loading available leads:{" "}
											{availableLeadsError.message}
										</div>
									) : availableLeadsLoading ? (
										<div className="text-center py-8">
											Loading available leads...
										</div>
									) : availableLeads?.data?.length === 0 ? (
										<div className="text-center py-8">
											<div className="text-gray-500 mb-4">
												No available leads found. All leads are either assigned
												to campaigns, blacklisted, or scheduled.
											</div>
											<Button
												onClick={() => cleanupOrphanedLeadsMutation.mutate()}
												disabled={cleanupOrphanedLeadsMutation.isPending}
												variant="outline"
											>
												{cleanupOrphanedLeadsMutation.isPending
													? "Cleaning..."
													: "Clean Orphaned Leads"}
											</Button>
										</div>
									) : (
										<div className="space-y-4">
											<div className="text-sm text-gray-600">
												Select leads to add to this campaign (max 5 leads per
												campaign):
											</div>

											<div className="overflow-x-auto">
												<Table>
													<TableHeader>
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
															<TableHead>Name</TableHead>
															<TableHead>Phone</TableHead>
															<TableHead>City</TableHead>
															<TableHead>Created</TableHead>
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

											<div className="flex justify-between items-center">
												<div className="text-sm text-gray-600">
													Selected: {selectedLeads.length} leads
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
															? "Adding..."
															: "Add Selected Leads"}
													</Button>
													<Button
														variant="outline"
														onClick={() => {
															setShowAddLeadsModal(false);
															setSelectedLeads([]);
														}}
														disabled={addLeadsToCampaignMutation.isPending}
													>
														Cancel
													</Button>
												</div>
											</div>

											{selectedLeads.length +
												(campaignData.leads?.length || 0) >
												5 && (
												<Alert variant="destructive">
													<AlertDescription>
														Cannot add more than 5 leads to a campaign. Current:{" "}
														{campaignData.leads?.length || 0}, Selected:{" "}
														{selectedLeads.length}
													</AlertDescription>
												</Alert>
											)}
										</div>
									)}
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
									Failed to update campaign. Please try again.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
