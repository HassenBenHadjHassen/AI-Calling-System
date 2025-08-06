"use client";

import { useState, useEffect } from "react";
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

const statusColors: Record<LeadStatus, string> = {
	NEW: "default",
	CALLED: "secondary",
	INTERESTED: "default",
	TRANSFERRED: "outline",
	FAILED: "destructive",
	BLACKLISTED: "destructive",
	SCHEDULED: "outline",
};

const statusLabels: Record<LeadStatus, string> = {
	NEW: "New Lead",
	CALLED: "Called",
	INTERESTED: "Interested",
	TRANSFERRED: "Transferred",
	FAILED: "Failed",
	BLACKLISTED: "Blacklisted",
	SCHEDULED: "Scheduled",
};

export default function LeadDetailPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { id } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation();

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

	if (isLeadLoading) {
		return (
			<div className="flex h-screen bg-gray-100">
				<Sidebar />
				<div className="flex-1 flex flex-col overflow-hidden">
					<Topbar />
					<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
						<div className="text-center py-8">
							{t("leadDetail.loadingLeadDetails")}
						</div>
					</main>
				</div>
			</div>
		);
	}

	const lead = leadData?.data;
	if (!lead) {
		return (
			<div className="flex h-screen bg-gray-100">
				<Sidebar />
				<div className="flex-1 flex flex-col overflow-hidden">
					<Topbar />
					<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
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
					</main>
				</div>
			</div>
		);
	}

	const callHistory = callHistoryData?.data || [];

	const handleStatusUpdate = () => {
		if (newStatus && newStatus !== lead.status) {
			updateStatusMutation.mutate(newStatus);
		}
	};

	const handleScheduleCall = () => {
		if (scheduleDate) {
			scheduleCallMutation.mutate({
				scheduledCallAt: scheduleDate,
				note: scheduleNote || undefined,
			});
		}
	};

	const handleTriggerCall = () => {
		triggerCallMutation.mutate();
	};

	const handleSave = () => {
		// Only update fields that have actually changed
		const updatedFields: Partial<Lead> = {};

		if (editedLead.name !== lead.name) updatedFields.name = editedLead.name;
		if (editedLead.address !== lead.address)
			updatedFields.address = editedLead.address;
		if (editedLead.city !== lead.city) updatedFields.city = editedLead.city;
		if (editedLead.postalCode !== lead.postalCode)
			updatedFields.postalCode = editedLead.postalCode;
		if (editedLead.phone1 !== lead.phone1)
			updatedFields.phone1 = editedLead.phone1;
		if (editedLead.phone2 !== lead.phone2)
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
		setEditedLead(lead);
		setIsEditing(false);
	};

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
									variant="outline"
									size="sm"
									onClick={() => navigate("/dashboard/leads")}
								>
									<ArrowLeft className="h-4 w-4 mr-2" />
									{t("leadDetail.backToLeads")}
								</Button>
								<div>
									<h1 className="text-2xl font-bold text-gray-900">
										{t("leadDetail.title")}
									</h1>
									<p className="text-gray-600">{t("leadDetail.description")}</p>
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
													{t("leadDetail.name")}
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
													{t("leadDetail.status")}
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
														{statusLabels[lead.status]}
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
													</TableRow>
												</TableHeader>
												<TableBody>
													{callHistory.map((call) => (
														<TableRow key={call.id}>
															<TableCell>{formatDate(call.callTime)}</TableCell>
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
																{call.notes || t("leadDetail.noNotes")}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										)}
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
												{Object.entries(statusLabels).map(([key, label]) => (
													<SelectItem key={key} value={key}>
														{label}
													</SelectItem>
												))}
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
											{t("leadDetail.triggerCall")}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<Button
											onClick={handleTriggerCall}
											disabled={triggerCallMutation.isPending}
											className="w-full"
										>
											{triggerCallMutation.isPending
												? t("leadDetail.triggering")
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
											disabled={!scheduleDate || scheduleCallMutation.isPending}
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
				</main>
			</div>
		</div>
	);
}
