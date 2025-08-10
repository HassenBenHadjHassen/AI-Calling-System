"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import i18n from "~/lib/i18n";
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
	MapPin,
	Calendar,
	Clock,
	User,
	Mail,
	Edit,
	Save,
	X,
	CheckCircle,
	PhoneCall,
	CalendarDays,
	Headphones,
	MicOff,
	Mic,
	MessageSquareText,
	PhoneOff,
	Share2,
	RefreshCw,
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
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState<string[]>([]);
	const [sayMessage, setSayMessage] = useState("");
	const [assistantMuted, setAssistantMuted] = useState(false);
	const [transferNumber, setTransferNumber] = useState("");
	const [transferMessage, setTransferMessage] = useState("");

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
		mutationFn: () =>
			callAPI.triggerCall(id!, leadTitle, leadData?.data?.name || ""),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["callHistory", id] });
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

	const lead = leadData?.data as Lead | undefined;

	const callHistory = callHistoryData?.data || [];

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
		triggerCallMutation.mutate();
	};

	// Socket per-call events
	useEffect(() => {
		if (!socket || !activeVapiCallId) return;
		socketService.joinCallRoom(activeVapiCallId);

		const onCallMessage = (data: any) => {
			if (data?.message?.transcript) {
				setTranscript((prev) => [...prev, data.message.transcript]);
			}
		};
		const onListeningStarted = () => setIsListening(true);
		const onListeningStopped = () => setIsListening(false);
		const onListeningError = (d: any) =>
			addToast(d?.error || "Listening error", "error");

		socket.on("call-message", onCallMessage);
		socket.on("call-listening-started", onListeningStarted);
		socket.on("call-listening-stopped", onListeningStopped);
		socket.on("call-listening-error", onListeningError);

		return () => {
			socket.off("call-message", onCallMessage);
			socket.off("call-listening-started", onListeningStarted);
			socket.off("call-listening-stopped", onListeningStopped);
			socket.off("call-listening-error", onListeningError);
		};
	}, [socket, activeVapiCallId, addToast]);

	const handleStartListening = () => {
		if (!activeVapiCallId) return addToast("No active call id", "error");
		socketService.startCallListening(activeVapiCallId);
	};

	const handleStopListening = () => {
		if (!activeVapiCallId) return;
		socketService.stopCallListening(activeVapiCallId);
	};

	const handleSay = async () => {
		if (!activeVapiCallId || !sayMessage.trim()) return;
		const res = await callAPI.sayMessage(activeVapiCallId, {
			message: sayMessage.trim(),
			endCallAfterSpoken: false,
		});
		if (res.success) {
			addToast("Message injected", "success");
			setSayMessage("");
		} else addToast(res.error || "Failed to send message", "error");
	};

	const handleMuteToggle = async () => {
		if (!activeVapiCallId) return;
		const action = assistantMuted ? "unmute-assistant" : "mute-assistant";
		const res = await callAPI.controlAssistant(activeVapiCallId, action);
		if (res.success) {
			setAssistantMuted(!assistantMuted);
		} else addToast(res.error || "Failed to control assistant", "error");
	};

	const handleEndCall = async () => {
		if (!activeVapiCallId) return;
		const res = await callAPI.endCall(activeVapiCallId);
		if (!res.success) addToast(res.error || "Failed to end call", "error");
	};

	const handleTransfer = async () => {
		if (!activeVapiCallId || !transferNumber.trim())
			return addToast("Enter destination number", "error");
		const res = await callAPI.transferCall(activeVapiCallId, {
			destinationNumber: transferNumber.trim(),
			transferMessage: transferMessage.trim() || undefined,
		});
		if (res.success) {
			addToast("Transfer initiated", "success");
			setTransferMessage("");
		} else addToast(res.error || "Failed to transfer", "error");
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
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
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
							<div className="flex items-center justify-between">
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
												disabled={updateLeadMutation.isPending}
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
												disabled={updateLeadMutation.isPending}
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
										>
											<Edit className="h-4 w-4 mr-2" />
											{t("leadDetail.edit")}
										</Button>
									)}
								</div>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
																		{call.callStatus}
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
									{/* Live Call Monitor & Control */}
									{/* <Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<Headphones className="h-5 w-5 mr-2" />
												Live Call Monitor
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="flex items-center gap-2">
												<Button
													variant={isListening ? "outline" : "default"}
													size="sm"
													onClick={
														isListening
															? handleStopListening
															: handleStartListening
													}
													disabled={!activeVapiCallId}
												>
													<Headphones className="h-4 w-4 mr-2" />
													{isListening ? "Stop Listening" : "Start Listening"}
												</Button>
												<Button
													variant={assistantMuted ? "default" : "outline"}
													size="sm"
													onClick={handleMuteToggle}
													disabled={!activeVapiCallId}
												>
													{assistantMuted ? (
														<MicOff className="h-4 w-4 mr-2" />
													) : (
														<Mic className="h-4 w-4 mr-2" />
													)}
													{assistantMuted
														? "Unmute Assistant"
														: "Mute Assistant"}
												</Button>
												<Button
													variant="destructive"
													size="sm"
													onClick={handleEndCall}
													disabled={!activeVapiCallId}
												>
													<PhoneOff className="h-4 w-4 mr-2" />
													End Call
												</Button>
											</div>

											<div className="space-y-2">
												<Label className="text-sm font-medium text-gray-700">
													Inject Message
												</Label>
												<div className="flex gap-2">
													<Input
														value={sayMessage}
														onChange={(e) => setSayMessage(e.target.value)}
														placeholder="Type a message for the assistant to say"
													/>
													<Button
														size="sm"
														onClick={handleSay}
														disabled={!activeVapiCallId || !sayMessage.trim()}
													>
														<MessageSquareText className="h-4 w-4 mr-2" />
														Send
													</Button>
												</div>
											</div>

											<div className="space-y-2">
												<Label className="text-sm font-medium text-gray-700">
													Transfer Call
												</Label>
												<div className="flex gap-2">
													<Input
														value={transferNumber}
														onChange={(e) => setTransferNumber(e.target.value)}
														placeholder="Destination number"
														className="w-40"
													/>
													<Input
														value={transferMessage}
														onChange={(e) => setTransferMessage(e.target.value)}
														placeholder="Optional message"
													/>
													<Button
														size="sm"
														onClick={handleTransfer}
														disabled={
															!activeVapiCallId || !transferNumber.trim()
														}
													>
														<Share2 className="h-4 w-4 mr-2" />
														Transfer
													</Button>
												</div>
											</div>

											<div className="space-y-2">
												<Label className="text-sm font-medium text-gray-700">
													Transcript (live)
												</Label>
												<div className="p-3 bg-white rounded border h-40 overflow-auto text-sm">
													{transcript.length === 0 ? (
														<div className="text-gray-500">
															No transcript yet
														</div>
													) : (
														transcript.map((line, idx) => (
															<div key={idx}>{line}</div>
														))
													)}
												</div>
											</div>
										</CardContent>
									</Card> */}
									{/* Status Update */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<CheckCircle className="h-5 w-5 mr-2" />
												{t("leadDetail.updateStatus")}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<Select
												value={newStatus}
												onValueChange={(value) =>
													setNewStatus(value as LeadStatus)
												}
											>
												<SelectTrigger>
													<SelectValue
														placeholder={t("leadDetail.selectNewStatus")}
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
													newStatus === lead.status
												}
												className="w-full"
											>
												{t("leadDetail.updateStatusBtn")}
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
										</CardHeader>
										<CardContent>
											<Button
												onClick={handleTriggerCall}
												disabled={
													triggerCallMutation.isPending ||
													lead.status !== "NEW" ||
													lead.blacklisted
												}
												className="w-full text-xs sm:text-sm leading-tight"
											>
												{triggerCallMutation.isPending
													? t("leadDetail.triggering")
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
