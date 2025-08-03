"use client";
import { Switch } from "@radix-ui/react-switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Square, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "~/components/ui/card";
import { campaignAPI, type Campaign } from "~/services/api";
import { formatDate } from "~/lib/utils";

export default function CampaignPage() {
	const queryClient = useQueryClient();

	const { data: campaigns, isLoading } = useQuery({
		queryKey: ["campaigns"],
		queryFn: () => campaignAPI.getCampaigns(),
	});

	const { data: activeCampaign } = useQuery({
		queryKey: ["active-campaign"],
		queryFn: () => campaignAPI.getActiveCampaign(),
	});

	const startCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.startCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
		},
	});

	const stopCampaignMutation = useMutation({
		mutationFn: (id: string) => campaignAPI.stopCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["active-campaign"] });
		},
	});

	const handleToggleCampaign = (campaign: Campaign) => {
		if (campaign.status === "ACTIVE") {
			stopCampaignMutation.mutate(campaign.id);
		} else {
			startCampaignMutation.mutate(campaign.id);
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

	return (
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
				<Button>
					<Plus className="h-4 w-4 mr-2" />
					New Campaign
				</Button>
			</div>

			{activeCampaign?.data && (
				<Card className="border-green-200 bg-green-50">
					<CardHeader>
						<CardTitle className="text-green-800">Active Campaign</CardTitle>
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
									onClick={() => handleToggleCampaign(activeCampaign.data)}
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
							No campaigns found. Create your first campaign to get started.
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
											<Badge variant={getStatusColor(campaign.status) as any}>
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
											</div>
										</div>
									</div>

									<div className="flex items-center space-x-4">
										<div className="flex items-center space-x-2">
											<span className="text-sm">
												{campaign.status === "ACTIVE" ? "Running" : "Stopped"}
											</span>
											<Switch
												checked={campaign.status === "ACTIVE"}
												onCheckedChange={() => handleToggleCampaign(campaign)}
												disabled={
													startCampaignMutation.isPending ||
													stopCampaignMutation.isPending
												}
											/>
										</div>

										<Button variant="outline" size="sm">
											View Details
										</Button>

										<Button
											variant="ghost"
											size="sm"
											className="text-red-600 hover:text-red-700"
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

			{(startCampaignMutation.isError || stopCampaignMutation.isError) && (
				<Alert variant="destructive">
					<AlertDescription>
						Failed to update campaign status. Please try again.
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
