"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
	ArrowLeft,
	Phone,
	Calendar,
	Clock,
	User,
	MapPin,
	MessageSquare,
	PhoneCall,
	CheckCircle,
	XCircle,
	Forward,
	FileText,
	Hash,
	Euro,
	Activity,
} from "lucide-react";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { formatDate, formatPhoneNumber, formatDuration } from "~/lib/utils";
import { callAPI, type CallHistory } from "~/services/api";
import { currencyService } from "~/services/currencyService";

const statusColors: Record<string, string> = {
	INITIATED: "secondary",
	COMPLETED: "default",
	TRANSFERRED: "outline",
	FAILED: "destructive",
	SCHEDULED: "outline",
};

export default function CallDetailPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { id } = useParams();
	const navigate = useNavigate();
	const { t } = useTranslation();

	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	// Fetch call details
	const { data: callData, isLoading: isCallLoading } = useQuery({
		queryKey: ["call", id],
		queryFn: () => callAPI.getCallById(id!),
		enabled: !!id,
	});

	const call = callData?.data as CallHistory | undefined;

	// Function to translate status
	const translateStatus = (status: string) => {
		switch (status) {
			case "INITIATED":
				return t("calls.initiated");
			case "COMPLETED":
				return t("calls.completed");
			case "TRANSFERRED":
				return t("calls.transferred");
			case "FAILED":
				return t("calls.failed");
			case "SCHEDULED":
				return t("calls.scheduled");
			default:
				return status;
		}
	};

	// Convert USD to EUR and format cost display
	const [costInEur, setCostInEur] = useState<number | null>(null);
	const [isLoadingCost, setIsLoadingCost] = useState(false);

	useEffect(() => {
		if (call?.cost !== undefined && call.cost !== null) {
			setIsLoadingCost(true);
			currencyService
				.convertUSDToEUR(call.cost)
				.then((convertedCost) => {
					setCostInEur(convertedCost);
				})
				.catch((error) => {
					console.error("Failed to convert currency:", error);
					// Fallback to static conversion
					setCostInEur((call.cost || 0) * 0.86);
				})
				.finally(() => {
					setIsLoadingCost(false);
				});
		} else {
			setCostInEur(null);
		}
	}, [call?.cost]);

	const formatCost = (cost?: number) => {
		if (cost === undefined || cost === null) return t("callDetail.na");

		if (isLoadingCost) {
			return t("callDetail.loading");
		}

		const usdCost = `$${cost.toFixed(2)}`;

		if (costInEur !== null) {
			return `${usdCost} / €${costInEur.toFixed(2)}`;
		}

		// Fallback to static conversion if API fails
		const fallbackRate = 0.86;
		const eurCost = (cost * fallbackRate).toFixed(2);
		return `${usdCost} / €${eurCost}`;
	};

	return (
		<div className="flex h-screen bg-gray-100">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
					{(!isClient || !isAuthenticated) && (
						<div className="flex items-center justify-center min-h-full">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
						</div>
					)}
					{isClient && isAuthenticated && isCallLoading && (
						<div className="text-center py-8">
							{t("callDetail.loadingCallDetails")}
						</div>
					)}
					{isClient && isAuthenticated && !isCallLoading && !call && (
						<div className="text-center py-8">
							<p className="text-gray-600">{t("callDetail.callNotFound")}</p>
							<Button
								variant="outline"
								onClick={() => navigate("/dashboard/leads")}
								className="mt-4"
							>
								{t("callDetail.backToLeads")}
							</Button>
						</div>
					)}
					{isClient && isAuthenticated && !isCallLoading && !!call && (
						<div className="space-y-6">
							{/* Header */}
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-4">
									<Button
										variant="outline"
										size="sm"
										onClick={() => navigate(-1)}
									>
										<ArrowLeft className="h-4 w-4 mr-2" />
										{t("callDetail.back")}
									</Button>
									<div>
										<h1 className="text-2xl font-bold text-gray-900">
											{t("callDetail.title")}
										</h1>
										<p className="text-gray-600">
											{t("callDetail.description")}
										</p>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<Badge
										variant={
											statusColors[call.callStatus] as
												| "default"
												| "secondary"
												| "destructive"
												| "outline"
										}
										className="text-sm"
									>
										{translateStatus(call.callStatus)}
									</Badge>
								</div>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								{/* Call Information */}
								<div className="lg:col-span-2 space-y-6">
									{/* Call Details */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<Phone className="h-5 w-5 mr-2" />
												{t("callDetail.callInformation")}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Hash className="h-4 w-4 mr-1" />
														{t("callDetail.callId")}
													</Label>
													<p className="text-gray-900 font-mono text-sm">
														{call.id}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Activity className="h-4 w-4 mr-1" />
														{t("callDetail.vapiCallId")}
													</Label>
													<p className="text-gray-900 font-mono text-sm">
														{call.vapiCallId || t("callDetail.na")}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<PhoneCall className="h-4 w-4 mr-1" />
														{t("callDetail.fromNumber")}
													</Label>
													<p className="text-gray-900">
														{call.lead?.phone1
															? formatPhoneNumber(call.lead.phone1)
															: t("callDetail.na")}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Phone className="h-4 w-4 mr-1" />
														{t("callDetail.toNumber")}
													</Label>
													<p className="text-gray-900">
														{call.lead?.phone1
															? formatPhoneNumber(call.lead.phone1)
															: t("callDetail.na")}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Calendar className="h-4 w-4 mr-1" />
														{t("callDetail.startTime")}
													</Label>
													<p className="text-gray-900">
														{formatDate(call.callTime)}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Clock className="h-4 w-4 mr-1" />
														{t("callDetail.duration")}
													</Label>
													<p className="text-gray-900">
														{call.duration
															? formatDuration(call.duration)
															: t("callDetail.na")}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Euro className="h-4 w-4 mr-1" />
														{t("callDetail.cost")}
													</Label>
													<p
														className="text-gray-900 cursor-help"
														title={t("callDetail.costTooltip")}
													>
														{formatCost(call.cost)}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<Forward className="h-4 w-4 mr-1" />
														{t("callDetail.transferred")}
													</Label>
													<p className="text-gray-900">
														{call.transferred ? (
															<span className="flex items-center text-green-600">
																<CheckCircle className="h-4 w-4 mr-1" />
																{t("callDetail.yes")}
															</span>
														) : (
															<span className="flex items-center text-gray-500">
																<XCircle className="h-4 w-4 mr-1" />
																{t("callDetail.no")}
															</span>
														)}
													</p>
												</div>
												{call.transferred && call.transferTo && (
													<div>
														<Label className="text-sm font-medium text-gray-700">
															{t("callDetail.transferTo")}
														</Label>
														<p className="text-gray-900">
															{formatPhoneNumber(call.transferTo)}
														</p>
													</div>
												)}
											</div>
										</CardContent>
									</Card>

									{/* Notes */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<MessageSquare className="h-5 w-5 mr-2" />
												{t("callDetail.notes")}
											</CardTitle>
										</CardHeader>
										<CardContent>
											{call.notes ? (
												<div className="bg-gray-50 p-4 rounded-lg">
													<p className="text-gray-900 whitespace-pre-wrap">
														{call.notes}
													</p>
												</div>
											) : (
												<p className="text-gray-500 italic">
													{t("callDetail.noNotes")}
												</p>
											)}
										</CardContent>
									</Card>
								</div>

								{/* Lead Information */}
								<div className="space-y-6">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<User className="h-5 w-5 mr-2" />
												{t("callDetail.leadInformation")}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div>
												<Label className="text-sm font-medium text-gray-700">
													{t("common.name")}
												</Label>
												<p className="text-gray-900">{call.lead?.name}</p>
											</div>
											<div>
												<Label className="text-sm font-medium text-gray-700">
													{t("callDetail.primaryPhone")}
												</Label>
												<p className="text-gray-900">
													{call.lead?.phone1
														? formatPhoneNumber(call.lead.phone1)
														: t("callDetail.na")}
												</p>
											</div>
											{call.lead?.phone2 && (
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("callDetail.secondaryPhone")}
													</Label>
													<p className="text-gray-900">
														{formatPhoneNumber(call.lead.phone2)}
													</p>
												</div>
											)}
											{call.lead?.address && (
												<div>
													<Label className="text-sm font-medium text-gray-700 flex items-center">
														<MapPin className="h-4 w-4 mr-1" />
														{t("callDetail.address")}
													</Label>
													<p className="text-gray-900">
														{call.lead.address}
														{call.lead.postalCode &&
															`, ${call.lead.postalCode}`}
														{call.lead.city && `, ${call.lead.city}`}
													</p>
												</div>
											)}
											<div>
												<Label className="text-sm font-medium text-gray-700">
													{t("common.status")}
												</Label>
												<Badge
													variant={
														statusColors[call.lead?.status || ""] as
															| "default"
															| "secondary"
															| "destructive"
															| "outline"
													}
													className="mt-1"
												>
													{call.lead?.status || t("callDetail.na")}
												</Badge>
											</div>
										</CardContent>
									</Card>

									{/* Campaign Information */}
									{call.campaignId && (
										<Card>
											<CardHeader>
												<CardTitle className="flex items-center">
													<FileText className="h-5 w-5 mr-2" />
													{t("callDetail.campaignInformation")}
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("callDetail.campaignName")}
													</Label>
													<p className="text-gray-900">
														{call.lead?.campaign?.name || t("callDetail.na")}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("callDetail.campaignStatus")}
													</Label>
													<Badge
														variant={
															call.lead?.campaign?.status === "ACTIVE"
																? "default"
																: "secondary"
														}
														className="mt-1"
													>
														{call.lead?.campaign?.status || t("callDetail.na")}
													</Badge>
												</div>
											</CardContent>
										</Card>
									)}

									{/* Actions */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<Activity className="h-5 w-5 mr-2" />
												{t("callDetail.actions")}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<Button
												variant="outline"
												onClick={() =>
													navigate(`/dashboard/leads/${call.leadId}`)
												}
												className="w-full"
											>
												<User className="h-4 w-4 mr-2" />
												{t("callDetail.viewLead")}
											</Button>
											{call.lead?.campaignId && (
												<Button
													variant="outline"
													onClick={() =>
														navigate(
															`/dashboard/campaign/${call.lead?.campaignId}`
														)
													}
													className="w-full"
												>
													<FileText className="h-4 w-4 mr-2" />
													{t("callDetail.viewCampaign")}
												</Button>
											)}
										</CardContent>
									</Card>
								</div>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
