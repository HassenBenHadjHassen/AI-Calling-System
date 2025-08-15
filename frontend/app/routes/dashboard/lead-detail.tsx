"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "~/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	ArrowLeft,
	Phone,
	Clock,
	User,
	Edit,
	Save,
	X,
	CheckCircle,
	PhoneCall,
	CalendarDays,
	RefreshCw,
	Menu,
	Loader2,
	Check,
} from "lucide-react";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { formatDate, formatPhoneNumber, formatDuration } from "~/lib/utils";
import { type Lead, type LeadStatus, leadAPI, callAPI } from "~/services/api";
// @ts-expect-error: No types available for 'gender-detection'
import gender from "gender-detection";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/components/ui/toast";
import { socketService } from "~/lib/socket";

const statusColors: Record<LeadStatus, string> = {
	NEW: "default",
	CALLED: "secondary",
	INTERESTED: "default",
	TRANSFERRED: "outline",
	FAILED: "destructive",
	BLACKLISTED: "destructive",
	SCHEDULED: "outline",
};

// Function to translate status - will be defined inside component

export default function LeadDetailPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { id } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { addToast } = useToast();
	const [socket, setSocket] = useState<any>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<"info" | "calls" | "actions">(
		"info"
	);

	// Function to translate status
	const translateStatus = (status: LeadStatus) => {
		switch (status) {
			case "NEW":
				return t("leads.new");
			case "CALLED":
				return t("leads.called");
			case "INTERESTED":
				return t("leads.interested");
			case "TRANSFERRED":
				return t("leads.transferred");
			case "FAILED":
				return t("leads.failed");
			case "BLACKLISTED":
				return t("leads.blacklisted");
			case "SCHEDULED":
				return t("leads.scheduled");
			default:
				return status;
		}
	};

	// Function to translate call status
	const translateCallStatus = (callStatus: string) => {
		switch (callStatus) {
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
				return callStatus;
		}
	};

	// Function to get user-friendly error message
	const getErrorMessage = (error: any): string => {
		const apiResponse = error?.response;
		const errorText = (
			apiResponse?.error ||
			error?.message ||
			""
		).toLowerCase();

		if (errorText.includes("blacklisted")) {
			return t("leadDetail.errorBlacklistedLead");
		}
		if (errorText.includes("status")) {
			return t("leadDetail.errorInvalidStatus");
		}
		if (errorText.includes("scheduled time")) {
			return t("leadDetail.errorScheduledTime");
		}
		if (errorText.includes("not found")) {
			return t("leadDetail.errorLeadNotFound");
		}
		if (errorText.includes("vapi")) {
			return t("leadDetail.errorVapiService");
		}
		if (errorText.includes("network") || errorText.includes("connection")) {
			return t("leadDetail.errorNetwork");
		}

		return (
			apiResponse?.error || error?.message || t("leadDetail.callTriggerError")
		);
	};

	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	const [isEditing, setIsEditing] = useState(false);
	const [editedLead, setEditedLead] = useState<Partial<Lead>>({});
	const [leadTitle, setLeadTitle] = useState("Monsieur");
	const [newStatus, setNewStatus] = useState<LeadStatus | "">("");
	const [scheduleNote, setScheduleNote] = useState("");
	const [scheduleDate, setScheduleDate] = useState("");
	const [activeVapiCallId, setActiveVapiCallId] = useState<string | null>(null);
	const [sayMessage, setSayMessage] = useState("");
	const [assistantMuted, setAssistantMuted] = useState(false);
	const isCallInProgress = useRef(false);

	// Fetch lead details
	const { data: leadData, isLoading: isLeadLoading } = useQuery({
		queryKey: ["lead", id],
		queryFn: () => leadAPI.getLeadById(id!),
		enabled: !!id,
	});

	// Fetch call history for this lead
	const { data: callHistoryData, isLoading: isCallHistoryLoading } = useQuery({
		queryKey: ["callHistory", id],
		queryFn: () => callAPI.getCallsByLead(id!),
		enabled: !!id,
	});

	// init socket client-side only
	useEffect(() => {
		if (!isClient) return;
		const s = socketService.connect();
		setSocket(s);
		return () => {
			socketService.disconnect();
		};
	}, [isClient]);

	// derive most recent vapiCallId from call history
	useEffect(() => {
		const latestActive = callHistoryData?.data?.find((c) => c.vapiCallId);
		if (latestActive?.vapiCallId) setActiveVapiCallId(latestActive.vapiCallId);
	}, [callHistoryData]);

	// Update lead status mutation
	const updateStatusMutation = useMutation({
		mutationFn: (status: LeadStatus) => leadAPI.updateLeadStatus(id!, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lead", id] });
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setNewStatus("");
		},
	});

	// Update lead mutation
	const updateLeadMutation = useMutation({
		mutationFn: (data: Partial<Lead>) => leadAPI.updateLead(id!, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lead", id] });
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setIsEditing(false);
		},
		onError: (error) => {
			console.error("Error updating lead:", error);
			// You could add a toast notification here
		},
	});

	// Schedule call mutation
	const scheduleCallMutation = useMutation({
		mutationFn: (data: { scheduledCallAt: string; note?: string }) =>
			leadAPI.scheduleCall({
				customerPhoneNumber: lead?.phone1 || "",
				scheduledCallAt: data.scheduledCallAt,
				note: data.note,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lead", id] });
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			queryClient.invalidateQueries({ queryKey: ["leads-overview"] });
			setScheduleDate("");
			setScheduleNote("");
		},
	});

	// Trigger call mutation
	const triggerCallMutation = useMutation({
		mutationFn: () => {
			console.log("Mutation function called");
			isCallInProgress.current = true;
			return callAPI.triggerCall(id!, leadTitle, leadData?.data?.name || "");
		},
		onSuccess: (data) => {
			console.log("Call triggered successfully", data);
			queryClient.invalidateQueries({ queryKey: ["callHistory", id] });

			// Show success message
			if (data?.data?.queued) {
				addToast(
					t("leadDetail.callQueuedSuccess", {
						position: data.data.queuePosition,
					}),
					"success"
				);
			} else {
				addToast(t("leadDetail.callTriggeredSuccess"), "success");
			}
		},
		onError: (error: any) => {
			console.log("Call trigger failed:", error);
			isCallInProgress.current = false;
			addToast(getErrorMessage(error), "error");
		},
		onSettled: () => {
			console.log("Call trigger settled");
			// Reset the flag after a delay to allow for call status updates
			setTimeout(() => {
				isCallInProgress.current = false;
			}, 2000);
		},
	});

	useEffect(() => {
		if (leadData?.data) {
			setEditedLead(leadData.data);
			// Detect gender immediately when lead data is available
			if (leadData.data.name) {
				const g = gender.detect(leadData.data.name);
				if (g === "male") {
					setLeadTitle("Monsieur");
				} else if (g === "female") {
					setLeadTitle("Madame");
				} else {
					setLeadTitle("Monsieur");
				}
			}
		}
	}, [leadData]);

	const lead = leadData?.data;

	const callHistory = callHistoryData?.data || [];

	// Check if there's an active call (INITIATED status)
	const hasActiveCall = callHistory.some(
		(call) => call.callStatus === "INITIATED"
	);

	// Reset the call in progress flag when we detect an active call
	useEffect(() => {
		if (hasActiveCall) {
			isCallInProgress.current = false;
		}
	}, [hasActiveCall]);

	const handleStatusUpdate = () => {
		if (lead && newStatus && newStatus !== lead.status) {
			updateStatusMutation.mutate(newStatus);
		}
	};

	const handleScheduleCall = () => {
		if (scheduleDate) {
			// Check if the selected date is in the past
			const selectedDate = new Date(scheduleDate);
			const now = new Date();

			if (selectedDate < now) {
				addToast(t("leadDetail.cannotScheduleInPast"), "error");
				return;
			}

			scheduleCallMutation.mutate({
				scheduledCallAt: scheduleDate,
				note: scheduleNote || undefined,
			});
		}
	};

	const handleTriggerCall = () => {
		console.log("handleTriggerCall called", {
			isPending: triggerCallMutation.isPending,
			hasActiveCall,
			isCallInProgress: isCallInProgress.current,
		});

		// Prevent multiple calls if already pending, if there's an active call, or if we're already processing a call
		if (
			triggerCallMutation.isPending ||
			hasActiveCall ||
			isCallInProgress.current
		) {
			console.log("Call blocked - already in progress");
			return;
		}
		console.log("Triggering call...");
		triggerCallMutation.mutate();
	};

	const handleSave = () => {
		// Only update fields that have actually changed
		const updatedFields: Partial<Lead> = {};

		if (lead && editedLead.name !== lead.name)
			updatedFields.name = editedLead.name;
		if (lead && editedLead.address !== lead.address)
			updatedFields.address = editedLead.address;
		if (lead && editedLead.city !== lead.city)
			updatedFields.city = editedLead.city;
		if (lead && editedLead.postalCode !== lead.postalCode)
			updatedFields.postalCode = editedLead.postalCode;
		if (lead && editedLead.phone1 !== lead.phone1)
			updatedFields.phone1 = editedLead.phone1;
		if (lead && editedLead.phone2 !== lead.phone2)
			updatedFields.phone2 = editedLead.phone2;

		// Only make the API call if there are actual changes
		if (Object.keys(updatedFields).length > 0) {
			updateLeadMutation.mutate(updatedFields);
		} else {
			// If no changes, just exit edit mode
			setIsEditing(false);
		}
	};

	const handleCancel = () => {
		// Reset the edited lead data to the original values
		if (lead) setEditedLead(lead);
		setIsEditing(false);
	};

	return (
		<div className="flex h-screen bg-gray-100">
			<Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar onMenuClick={() => setIsSidebarOpen((v) => !v)} />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
					{(!isClient || !isAuthenticated) && (
						<div className="flex items-center justify-center min-h-full">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
						</div>
					)}
					{isClient && isAuthenticated && isLeadLoading && (
						<div className="text-center py-8">
							{t("leadDetail.loadingLeadDetails")}
						</div>
					)}
					{isClient && isAuthenticated && !isLeadLoading && !lead && (
						<div className="text-center py-8">
							<p className="text-gray-600">{t("leadDetail.leadNotFound")}</p>
							<Button
								variant="outline"
								onClick={() => navigate("/dashboard/leads")}
								className="mt-4"
							>
								{t("leadDetail.backToLeads")}
							</Button>
						</div>
					)}
					{isClient && isAuthenticated && !isLeadLoading && !!lead && (
						<div className="space-y-6">
							{/* Header */}
							<div className="flex items-center justify-between md:block hidden">
								<div className="flex items-center space-x-4">
									<Button
										variant="outline"
										size="sm"
										onClick={() => navigate(-1)}
									>
										<ArrowLeft className="h-4 w-4 mr-2" />
										{t("leadDetail.backToLeads")}
									</Button>
									<div>
										<h1 className="text-2xl font-bold text-gray-900">
											{t("leadDetail.title")}
										</h1>
										<p className="text-gray-600">
											{t("leadDetail.description")}
										</p>
									</div>
								</div>
								<div className="flex space-x-2">
									{isEditing ? (
										<>
											<Button
												size="sm"
												onClick={handleSave}
												disabled={updateLeadMutation.isPending || hasActiveCall}
											>
												<Save className="h-4 w-4 mr-2" />
												{updateLeadMutation.isPending
													? t("leadDetail.saving")
													: t("leadDetail.save")}
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={handleCancel}
												disabled={updateLeadMutation.isPending || hasActiveCall}
											>
												<X className="h-4 w-4 mr-2" />
												{t("leadDetail.cancel")}
											</Button>
										</>
									) : (
										<Button
											variant="outline"
											size="sm"
											onClick={() => setIsEditing(true)}
											disabled={hasActiveCall}
										>
											<Edit className="h-4 w-4 mr-2" />
											{hasActiveCall
												? `${t("leadDetail.edit")} (${t(
														"leadDetail.callInProgress"
												  )})`
												: t("leadDetail.edit")}
										</Button>
									)}
								</div>
							</div>

							{/* Mobile Tab Navigation - Only on Mobile */}
							<div className="lg:hidden">
								{/* Mobile Header with Back Button and Title */}
								<div className="flex items-center space-x-3 mb-4">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => navigate(-1)}
										className="p-2 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 border-0"
									>
										<ArrowLeft className="h-5 w-5 text-gray-600" />
									</Button>
									<div className="flex-1">
										<h1 className="text-xl font-bold text-gray-900">
											{t("leadDetail.title")}
										</h1>
										<p className="text-sm text-gray-500">{lead.name}</p>
									</div>
								</div>

								<div className="flex space-x-1 bg-white p-2 rounded-xl shadow-sm border">
									<button
										onClick={() => setActiveTab("info")}
										className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
											activeTab === "info"
												? "bg-blue-50 text-blue-700 border border-blue-200"
												: "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
										}`}
									>
										{t("leadDetail.leadInformation")}
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
									<button
										onClick={() => setActiveTab("actions")}
										className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
											activeTab === "actions"
												? "bg-blue-50 text-blue-700 border border-blue-200"
												: "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
										}`}
									>
										{t("leadDetail.actions") || "Actions"}
									</button>
								</div>
							</div>

							{/* Mobile Content - Only on Mobile */}
							<div className="lg:hidden">
								{activeTab === "info" && (
									<div className="space-y-6">
										{/* Lead Information Card */}
										<Card className="border-0 shadow-lg bg-white rounded-2xl">
											<CardHeader className="pb-6 pt-6 px-6">
												<CardTitle className="flex items-center text-xl font-bold text-gray-900">
													<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
														<User className="h-5 w-5 text-blue-600" />
													</div>
													{t("leadDetail.leadInformation")}
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-6 px-6 pb-6">
												{/* Status and Edit Button Row */}
												<div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
													<div className="flex items-center space-x-3">
														<Badge
															variant={
																statusColors[lead.status] as
																	| "default"
																	| "secondary"
																	| "destructive"
																	| "outline"
															}
															className="text-sm px-4 py-2 font-semibold"
														>
															{translateStatus(lead.status)}
														</Badge>
														{hasActiveCall && (
															<Badge
																variant="destructive"
																className="animate-pulse text-sm px-4 py-2 font-semibold"
															>
																{t("leadDetail.callInProgress")}
															</Badge>
														)}
													</div>
													{!isEditing && (
														<Button
															variant="outline"
															size="sm"
															onClick={() => setIsEditing(true)}
															disabled={hasActiveCall}
															className="px-4 py-2 text-sm font-medium border-gray-300 hover:bg-gray-50"
														>
															<Edit className="h-4 w-4 mr-2" />
															{t("leadDetail.edit")}
														</Button>
													)}
												</div>

												{/* Lead Details Grid */}
												<div className="space-y-6">
													<div className="grid grid-cols-1 gap-6">
														<div className="space-y-3">
															<Label className="text-sm font-semibold text-gray-700">
																{t("leadDetail.titleLabel")}
															</Label>
															<div className="bg-gray-50 p-4 rounded-xl">
																<p className="text-base font-medium text-gray-900">
																	{leadTitle}
																</p>
															</div>
														</div>
														<div className="space-y-3">
															<Label className="text-sm font-semibold text-gray-700">
																{t("common.name")}
															</Label>
															{isEditing ? (
																<Input
																	value={editedLead.name || ""}
																	onChange={(e) =>
																		setEditedLead({
																			...editedLead,
																			name: e.target.value,
																		})
																	}
																	className="h-12 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																/>
															) : (
																<div className="bg-gray-50 p-4 rounded-xl">
																	<p className="text-base font-medium text-gray-900">
																		{lead.name}
																	</p>
																</div>
															)}
														</div>
														<div className="space-y-3">
															<Label className="text-sm font-semibold text-gray-700">
																{t("common.phone")}
															</Label>
															{isEditing ? (
																<Input
																	value={editedLead.phone1 || ""}
																	onChange={(e) =>
																		setEditedLead({
																			...editedLead,
																			phone1: e.target.value,
																		})
																	}
																	className="h-12 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																/>
															) : (
																<div className="bg-gray-50 p-4 rounded-xl">
																	<p className="text-base font-medium text-gray-900">
																		{formatPhoneNumber(lead.phone1)}
																	</p>
																</div>
															)}
														</div>
														<div className="space-y-3">
															<Label className="text-sm font-semibold text-gray-700">
																{t("leadDetail.secondaryPhone")}
															</Label>
															{isEditing ? (
																<Input
																	value={editedLead.phone2 || ""}
																	onChange={(e) =>
																		setEditedLead({
																			...editedLead,
																			phone2: e.target.value,
																		})
																	}
																	className="h-12 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																/>
															) : (
																<div className="bg-gray-50 p-4 rounded-xl">
																	<p className="text-base font-medium text-gray-900">
																		{lead.phone2
																			? formatPhoneNumber(lead.phone2)
																			: t("leadDetail.na")}
																	</p>
																</div>
															)}
														</div>
														<div className="space-y-3">
															<Label className="text-sm font-semibold text-gray-700">
																{t("leadDetail.address")}
															</Label>
															{isEditing ? (
																<Input
																	value={editedLead.address || ""}
																	onChange={(e) =>
																		setEditedLead({
																			...editedLead,
																			address: e.target.value,
																		})
																	}
																	className="h-12 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																/>
															) : (
																<div className="bg-gray-50 p-4 rounded-xl">
																	<p className="text-base font-medium text-gray-900">
																		{lead.address || t("leadDetail.na")}
																	</p>
																</div>
															)}
														</div>
														<div className="grid grid-cols-2 gap-4">
															<div className="space-y-3">
																<Label className="text-sm font-semibold text-gray-700">
																	{t("leadDetail.city")}
																</Label>
																{isEditing ? (
																	<Input
																		value={editedLead.city || ""}
																		onChange={(e) =>
																			setEditedLead({
																				...editedLead,
																				city: e.target.value,
																			})
																		}
																		className="h-12 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																	/>
																) : (
																	<div className="bg-gray-50 p-4 rounded-xl">
																		<p className="text-base font-medium text-gray-900">
																			{lead.city || t("leadDetail.na")}
																		</p>
																	</div>
																)}
															</div>
															<div className="space-y-3">
																<Label className="text-sm font-semibold text-gray-700">
																	{t("leadDetail.postalCode")}
																</Label>
																{isEditing ? (
																	<Input
																		value={editedLead.postalCode || ""}
																		onChange={(e) =>
																			setEditedLead({
																				...editedLead,
																				postalCode: e.target.value,
																			})
																		}
																		className="h-12 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																	/>
																) : (
																	<div className="bg-gray-50 p-4 rounded-xl">
																		<p className="text-base font-medium text-gray-900">
																			{lead.postalCode || t("leadDetail.na")}
																		</p>
																	</div>
																)}
															</div>
														</div>
													</div>

													{/* Edit Actions */}
													{isEditing && (
														<div className="flex space-x-3 pt-6 border-t border-gray-200">
															<Button
																onClick={handleSave}
																disabled={
																	updateLeadMutation.isPending || hasActiveCall
																}
																className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl"
															>
																{updateLeadMutation.isPending ? (
																	<>
																		<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																		{t("common.saving")}
																	</>
																) : (
																	<>
																		<Check className="h-4 w-4 mr-2" />
																		{t("common.save")}
																	</>
																)}
															</Button>
															<Button
																variant="outline"
																onClick={handleCancel}
																disabled={
																	updateLeadMutation.isPending || hasActiveCall
																}
																className="flex-1 h-12 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
															>
																<X className="h-4 w-4 mr-2" />
																{t("leadDetail.cancel")}
															</Button>
														</div>
													)}
												</div>
											</CardContent>
										</Card>
									</div>
								)}

								{/* Mobile Content - Calls Tab */}
								{activeTab === "calls" && (
									<div className="space-y-4">
										<Card className="border-0 shadow-sm">
											<CardHeader className="pb-4">
												<CardTitle className="flex items-center text-lg font-semibold">
													<Phone className="h-5 w-5 mr-2 text-blue-600" />
													{t("leadDetail.callHistory")}
												</CardTitle>
											</CardHeader>
											<CardContent>
												{isCallHistoryLoading ? (
													<div className="text-center py-8">
														{t("leadDetail.loadingCallHistory")}
													</div>
												) : callHistory.length === 0 ? (
													<div className="text-center py-8 text-gray-500">
														{t("leadDetail.noCallHistory")}
													</div>
												) : (
													<div className="space-y-3">
														{callHistory.map((call) => (
															<div
																key={call.id}
																className="p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all duration-200"
																onClick={() =>
																	navigate(`/dashboard/calls/${call.id}`)
																}
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
																		{translateCallStatus(call.callStatus)}
																	</Badge>
																	<span className="text-xs text-gray-500 font-medium">
																		{formatDate(call.callTime)}
																	</span>
																</div>
																<div className="text-sm text-gray-600 mb-2">
																	{call.duration
																		? formatDuration(call.duration)
																		: t("leadDetail.na")}
																</div>
																{call.notes && (
																	<div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
																		{call.notes.length > 50
																			? `${call.notes.substring(0, 50)}...`
																			: call.notes}
																	</div>
																)}
															</div>
														))}
													</div>
												)}
											</CardContent>
										</Card>
									</div>
								)}

								{/* Mobile Content - Actions Tab */}
								{activeTab === "actions" && (
									<div className="space-y-4">
										{/* Quick Actions */}
										<div className="grid grid-cols-1 gap-4">
											<Button
												onClick={handleTriggerCall}
												disabled={
													triggerCallMutation.isPending ||
													lead.status !== "NEW" ||
													lead.blacklisted ||
													hasActiveCall ||
													isCallInProgress.current
												}
												className="h-20 flex flex-col items-center justify-center space-y-2 bg-green-600 hover:bg-green-700 border-0 shadow-sm"
											>
												<PhoneCall className="h-7 w-7" />
												<span className="text-sm font-medium">
													{t("leadDetail.callNow")}
												</span>
											</Button>
										</div>

										{/* Status Update */}
										<Card className="border-0 shadow-sm">
											<CardHeader className="pb-4">
												<CardTitle className="flex items-center text-lg font-semibold">
													<CheckCircle className="h-5 w-5 mr-2 text-blue-600" />
													{t("leadDetail.updateStatus")}
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<Select
													value={newStatus}
													onValueChange={(value) =>
														setNewStatus(value as LeadStatus)
													}
													disabled={hasActiveCall}
												>
													<SelectTrigger className="border-gray-200">
														<SelectValue
															placeholder={
																hasActiveCall
																	? t("leadDetail.callInProgress")
																	: t("leadDetail.selectNewStatus")
															}
														/>
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="NEW">
															{t("leads.new")}
														</SelectItem>
														<SelectItem value="CALLED">
															{t("leads.called")}
														</SelectItem>
														<SelectItem value="INTERESTED">
															{t("leads.interested")}
														</SelectItem>
														<SelectItem value="TRANSFERRED">
															{t("leads.transferred")}
														</SelectItem>
														<SelectItem value="FAILED">
															{t("leads.failed")}
														</SelectItem>
														<SelectItem value="BLACKLISTED">
															{t("leads.blacklisted")}
														</SelectItem>
													</SelectContent>
												</Select>
												<Button
													onClick={handleStatusUpdate}
													disabled={
														!newStatus ||
														lead.status === "SCHEDULED" ||
														newStatus === lead.status ||
														hasActiveCall
													}
													className="w-full bg-blue-600 hover:bg-blue-700"
												>
													{t("leadDetail.updateStatusBtn")}
												</Button>
											</CardContent>
										</Card>

										{/* Schedule Call */}
										<Card className="border-0 shadow-sm">
											<CardHeader className="pb-4">
												<CardTitle className="flex items-center text-lg font-semibold">
													<CalendarDays className="h-5 w-5 mr-2 text-blue-600" />
													{t("leadDetail.scheduleCall")}
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="space-y-2">
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.dateTime")}
													</Label>
													<Input
														type="datetime-local"
														value={scheduleDate}
														onChange={(e) => setScheduleDate(e.target.value)}
														className="border-gray-200"
													/>
												</div>
												<div className="space-y-2">
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.note")}
													</Label>
													<Textarea
														value={scheduleNote}
														onChange={(e) => setScheduleNote(e.target.value)}
														placeholder={t("leadDetail.addNote")}
														className="border-gray-200"
														rows={3}
													/>
												</div>
												<Button
													onClick={handleScheduleCall}
													disabled={
														!scheduleDate || scheduleCallMutation.isPending
													}
													className="w-full bg-blue-600 hover:bg-blue-700"
												>
													{scheduleCallMutation.isPending
														? t("leadDetail.scheduling")
														: t("leadDetail.scheduleCallBtn")}
												</Button>
											</CardContent>
										</Card>

										{/* Scheduled Call Info */}
										{lead.scheduledCallAt && (
											<Card className="border-0 shadow-sm bg-blue-50">
												<CardHeader className="pb-4">
													<CardTitle className="flex items-center text-lg font-semibold text-blue-800">
														<Clock className="h-5 w-5 mr-2" />
														{t("leadDetail.scheduledCall")}
													</CardTitle>
												</CardHeader>
												<CardContent className="space-y-3">
													<div className="space-y-2">
														<Label className="text-sm font-medium text-blue-700">
															{t("leadDetail.scheduledFor")}
														</Label>
														<p className="text-sm font-medium text-blue-900">
															{formatDate(lead.scheduledCallAt)}
														</p>
													</div>
													{lead.scheduledCallNote && (
														<div className="space-y-2">
															<Label className="text-sm font-medium text-blue-700">
																{t("leadDetail.note")}
															</Label>
															<p className="text-sm text-blue-900 bg-white p-3 rounded-lg border border-blue-200">
																{lead.scheduledCallNote}
															</p>
														</div>
													)}
												</CardContent>
											</Card>
										)}
									</div>
								)}
							</div>

							{/* Desktop Layout - Original Design */}
							<div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
								{/* Lead Information */}
								<div className="lg:col-span-2 space-y-6">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<User className="h-5 w-5 mr-2" />
												{t("leadDetail.leadInformation")}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.titleLabel")}
													</Label>
													<p className="text-gray-900">{leadTitle}</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("common.name")}
													</Label>
													{isEditing ? (
														<Input
															value={editedLead.name || ""}
															onChange={(e) =>
																setEditedLead({
																	...editedLead,
																	name: e.target.value,
																})
															}
															className="mt-1"
															disabled={hasActiveCall}
														/>
													) : (
														<p className="text-gray-900">{lead.name}</p>
													)}
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("common.status")}
													</Label>
													<div className="flex items-center space-x-2 mt-1">
														<Badge
															variant={
																statusColors[lead.status] as
																	| "default"
																	| "secondary"
																	| "destructive"
																	| "outline"
															}
														>
															{translateStatus(lead.status)}
														</Badge>
														{hasActiveCall && (
															<Badge
																variant="destructive"
																className="animate-pulse"
															>
																{t("leadDetail.callInProgress")}
															</Badge>
														)}
													</div>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.primaryPhone")}
													</Label>
													{isEditing ? (
														<Input
															value={editedLead.phone1 || ""}
															onChange={(e) =>
																setEditedLead({
																	...editedLead,
																	phone1: e.target.value,
																})
															}
															className="mt-1"
															disabled={hasActiveCall}
														/>
													) : (
														<p className="text-gray-900">
															{formatPhoneNumber(lead.phone1)}
														</p>
													)}
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.secondaryPhone")}
													</Label>
													{isEditing ? (
														<Input
															value={editedLead.phone2 || ""}
															onChange={(e) =>
																setEditedLead({
																	...editedLead,
																	phone2: e.target.value,
																})
															}
															className="mt-1"
															disabled={hasActiveCall}
														/>
													) : (
														<p className="text-gray-900">
															{lead.phone2
																? formatPhoneNumber(lead.phone2)
																: t("leadDetail.na")}
														</p>
													)}
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.address")}
													</Label>
													{isEditing ? (
														<Input
															value={editedLead.address || ""}
															onChange={(e) =>
																setEditedLead({
																	...editedLead,
																	address: e.target.value,
																})
															}
															className="mt-1"
															disabled={hasActiveCall}
														/>
													) : (
														<p className="text-gray-900">
															{lead.address || t("leadDetail.na")}
														</p>
													)}
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.city")}
													</Label>
													{isEditing ? (
														<Input
															value={editedLead.city || ""}
															onChange={(e) =>
																setEditedLead({
																	...editedLead,
																	city: e.target.value,
																})
															}
															className="mt-1"
															disabled={hasActiveCall}
														/>
													) : (
														<p className="text-gray-900">
															{lead.city || t("leadDetail.na")}
														</p>
													)}
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.postalCode")}
													</Label>
													{isEditing ? (
														<Input
															value={editedLead.postalCode || ""}
															onChange={(e) =>
																setEditedLead({
																	...editedLead,
																	postalCode: e.target.value,
																})
															}
															className="mt-1"
															disabled={hasActiveCall}
														/>
													) : (
														<p className="text-gray-900">
															{lead.postalCode || t("leadDetail.na")}
														</p>
													)}
												</div>
											</div>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.created")}
													</Label>
													<p className="text-gray-900">
														{formatDate(lead.createdAt)}
													</p>
												</div>
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.lastUpdated")}
													</Label>
													<p className="text-gray-900">
														{formatDate(lead.updatedAt)}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>

									{/* Call History */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<Phone className="h-5 w-5 mr-2" />
												{t("leadDetail.callHistory")}
											</CardTitle>
										</CardHeader>
										<CardContent>
											{isCallHistoryLoading ? (
												<div className="text-center py-4">
													{t("leadDetail.loadingCallHistory")}
												</div>
											) : callHistory.length === 0 ? (
												<div className="text-center py-8 text-gray-500">
													{t("leadDetail.noCallHistory")}
												</div>
											) : (
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>{t("common.date")}</TableHead>
															<TableHead>{t("common.status")}</TableHead>
															<TableHead>{t("common.duration")}</TableHead>
															<TableHead>{t("common.notes")}</TableHead>
															<TableHead className="w-20"></TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{callHistory.map((call) => (
															<TableRow
																key={call.id}
																className="cursor-pointer hover:bg-gray-50"
																onClick={() =>
																	navigate(`/dashboard/calls/${call.id}`)
																}
															>
																<TableCell>
																	{formatDate(call.callTime)}
																</TableCell>
																<TableCell>
																	<Badge
																		variant={
																			call.callStatus === "COMPLETED"
																				? "default"
																				: call.callStatus === "FAILED"
																				? "destructive"
																				: "secondary"
																		}
																	>
																		{translateCallStatus(call.callStatus)}
																	</Badge>
																</TableCell>
																<TableCell>
																	{call.duration
																		? formatDuration(call.duration)
																		: t("leadDetail.na")}
																</TableCell>
																<TableCell>
																	{call.notes ? (
																		call.notes.length > 20 ? (
																			<span title={call.notes}>
																				{call.notes.substring(0, 20)}...
																			</span>
																		) : (
																			call.notes
																		)
																	) : (
																		t("leadDetail.noNotes")
																	)}
																</TableCell>
																<TableCell>
																	<Button
																		variant="outline"
																		size="sm"
																		onClick={(e) => {
																			e.stopPropagation();
																			navigate(`/dashboard/calls/${call.id}`);
																		}}
																	>
																		{t("leadDetail.viewDetails")}
																	</Button>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											)}
											<div className="flex justify-end mt-4">
												<Button
													variant="outline"
													size="sm"
													onClick={async () => {
														try {
															const result =
																await callAPI.reconcileStaleCallsViaScheduler();
															if (result.success) {
																addToast(
																	`Reconciled ${result.data.finalized} stale calls`,
																	"success"
																);
																// Refresh call history
																queryClient.invalidateQueries({
																	queryKey: ["callHistory", id],
																});
															} else {
																addToast(
																	result.error || "Failed to reconcile calls",
																	"error"
																);
															}
														} catch (error) {
															addToast(
																"Failed to reconcile stale calls",
																"error"
															);
														}
													}}
												>
													<RefreshCw className="h-4 w-4 mr-2" />
													Reconcile Stale Calls
												</Button>
											</div>
										</CardContent>
									</Card>
								</div>

								{/* Actions Sidebar */}
								<div className="space-y-6">
									{/* Status Update */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<CheckCircle className="h-5 w-5 mr-2" />
												{t("leadDetail.updateStatus")}
											</CardTitle>
											{hasActiveCall && (
												<p className="text-sm text-amber-600 mt-1">
													⚠️ {t("leadDetail.callInProgress")} -{" "}
													{t("leadDetail.callInProgressStatusDisabled")}
												</p>
											)}
										</CardHeader>
										<CardContent className="space-y-4">
											<Select
												value={newStatus}
												onValueChange={(value) =>
													setNewStatus(value as LeadStatus)
												}
												disabled={hasActiveCall}
											>
												<SelectTrigger>
													<SelectValue
														placeholder={
															hasActiveCall
																? t("leadDetail.callInProgress")
																: t("leadDetail.selectNewStatus")
														}
													/>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="NEW">{t("leads.new")}</SelectItem>
													<SelectItem value="CALLED">
														{t("leads.called")}
													</SelectItem>
													<SelectItem value="INTERESTED">
														{t("leads.interested")}
													</SelectItem>
													<SelectItem value="TRANSFERRED">
														{t("leads.transferred")}
													</SelectItem>
													<SelectItem value="FAILED">
														{t("leads.failed")}
													</SelectItem>
													<SelectItem value="BLACKLISTED">
														{t("leads.blacklisted")}
													</SelectItem>
												</SelectContent>
											</Select>
											<Button
												onClick={handleStatusUpdate}
												disabled={
													!newStatus ||
													lead.status === "SCHEDULED" ||
													newStatus === lead.status ||
													hasActiveCall
												}
												className="w-full"
											>
												{hasActiveCall
													? `${t("leadDetail.updateStatusBtn")} (${t(
															"leadDetail.callInProgress"
													  )})`
													: t("leadDetail.updateStatusBtn")}
											</Button>
										</CardContent>
									</Card>

									{/* Trigger Call */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<PhoneCall className="h-5 w-5 mr-2" />
												<span>{t("leadDetail.triggerCall")}</span>
											</CardTitle>
											{hasActiveCall && (
												<p className="text-sm text-amber-600 mt-1">
													⚠️ {t("leadDetail.callInProgress")} -{" "}
													{t("leadDetail.callInProgressNewCallsDisabled")}
												</p>
											)}
											{triggerCallMutation.isError && (
												<p className="text-sm text-red-600 mt-1">
													❌ {t("leadDetail.callTriggerError")}
												</p>
											)}
										</CardHeader>
										<CardContent>
											<Button
												onClick={handleTriggerCall}
												disabled={
													triggerCallMutation.isPending ||
													lead.status !== "NEW" ||
													lead.blacklisted ||
													hasActiveCall ||
													isCallInProgress.current
												}
												className={`w-full text-xs sm:text-sm leading-tight ${
													triggerCallMutation.isError ? "border-red-500" : ""
												}`}
											>
												{triggerCallMutation.isPending
													? t("leadDetail.triggering")
													: hasActiveCall
													? `${t("leadDetail.callNow")} (${t(
															"leadDetail.callInProgress"
													  )})`
													: isCallInProgress.current
													? `${t("leadDetail.callNow")} (${t(
															"leadDetail.triggering"
													  )})`
													: lead.status !== "NEW"
													? `${t("leadDetail.callNow")} (${t(
															"leadDetail.onlyNewLeads"
													  )})`
													: lead.blacklisted
													? `${t("leadDetail.callNow")} (${t(
															"leadDetail.blacklisted"
													  )})`
													: t("leadDetail.callNow")}
											</Button>
										</CardContent>
									</Card>

									{/* Schedule Call */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<CalendarDays className="h-5 w-5 mr-2" />
												{t("leadDetail.scheduleCall")}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div>
												<Label className="text-sm font-medium text-gray-700">
													{t("leadDetail.dateTime")}
												</Label>
												<Input
													type="datetime-local"
													value={scheduleDate}
													onChange={(e) => setScheduleDate(e.target.value)}
													className="mt-1"
												/>
											</div>
											<div>
												<Label className="text-sm font-medium text-gray-700">
													{t("leadDetail.note")}
												</Label>
												<Textarea
													value={scheduleNote}
													onChange={(e) => setScheduleNote(e.target.value)}
													placeholder={t("leadDetail.addNote")}
													className="mt-1"
													rows={3}
												/>
											</div>
											<Button
												onClick={handleScheduleCall}
												disabled={
													!scheduleDate || scheduleCallMutation.isPending
												}
												className="w-full"
											>
												{scheduleCallMutation.isPending
													? t("leadDetail.scheduling")
													: t("leadDetail.scheduleCallBtn")}
											</Button>
										</CardContent>
									</Card>

									{/* Scheduled Call Info */}
									{lead.scheduledCallAt && (
										<Card>
											<CardHeader>
												<CardTitle className="flex items-center">
													<Clock className="h-5 w-5 mr-2" />
													{t("leadDetail.scheduledCall")}
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-2">
												<div>
													<Label className="text-sm font-medium text-gray-700">
														{t("leadDetail.scheduledFor")}
													</Label>
													<p className="text-gray-900">
														{formatDate(lead.scheduledCallAt)}
													</p>
												</div>
												{lead.scheduledCallNote && (
													<div>
														<Label className="text-sm font-medium text-gray-700">
															{t("leadDetail.note")}
														</Label>
														<p className="text-gray-900">
															{lead.scheduledCallNote}
														</p>
													</div>
												)}
											</CardContent>
										</Card>
									)}
								</div>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
