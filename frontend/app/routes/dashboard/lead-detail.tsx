"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
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
		mutationFn: () => callAPI.triggerCall(id!, "Mr", "John Doe"),
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
						<div className="text-center py-8">Loading lead details...</div>
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
							<p className="text-gray-600">Lead not found</p>
							<Button
								variant="outline"
								onClick={() => navigate("/dashboard/leads")}
								className="mt-4"
							>
								Back to Leads
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
									Back to Leads
								</Button>
								<div>
									<h1 className="text-2xl font-bold text-gray-900">
										Lead Details
									</h1>
									<p className="text-gray-600">
										Manage lead information and call history
									</p>
								</div>
							</div>
							<div className="flex space-x-2">
								{isEditing ? (
									<>
										<Button size="sm" onClick={() => setIsEditing(false)}>
											<Save className="h-4 w-4 mr-2" />
											Save
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setIsEditing(false)}
										>
											<X className="h-4 w-4 mr-2" />
											Cancel
										</Button>
									</>
								) : (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsEditing(true)}
									>
										<Edit className="h-4 w-4 mr-2" />
										Edit
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
											Lead Information
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<Label className="text-sm font-medium text-gray-700">
													Title
												</Label>
												<p className="text-gray-900">{leadTitle}</p>
											</div>
											<div>
												<Label className="text-sm font-medium text-gray-700">
													Name
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
													Status
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
													Primary Phone
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
													Secondary Phone
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
															: "N/A"}
													</p>
												)}
											</div>
											<div>
												<Label className="text-sm font-medium text-gray-700">
													Address
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
														{lead.address || "N/A"}
													</p>
												)}
											</div>
											<div>
												<Label className="text-sm font-medium text-gray-700">
													City
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
													<p className="text-gray-900">{lead.city || "N/A"}</p>
												)}
											</div>
										</div>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<Label className="text-sm font-medium text-gray-700">
													Created
												</Label>
												<p className="text-gray-900">
													{formatDate(lead.createdAt)}
												</p>
											</div>
											<div>
												<Label className="text-sm font-medium text-gray-700">
													Last Updated
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
											Call History
										</CardTitle>
									</CardHeader>
									<CardContent>
										{isCallHistoryLoading ? (
											<div className="text-center py-4">
												Loading call history...
											</div>
										) : callHistory.length === 0 ? (
											<div className="text-center py-8 text-gray-500">
												No call history available
											</div>
										) : (
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Date</TableHead>
														<TableHead>Status</TableHead>
														<TableHead>Duration</TableHead>
														<TableHead>Notes</TableHead>
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
																	: "N/A"}
															</TableCell>
															<TableCell>{call.notes || "No notes"}</TableCell>
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
											Update Status
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
												<SelectValue placeholder="Select new status" />
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
											disabled={!newStatus || newStatus === lead.status}
											className="w-full"
										>
											Update Status
										</Button>
									</CardContent>
								</Card>

								{/* Trigger Call */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center">
											<PhoneCall className="h-5 w-5 mr-2" />
											Trigger Call
										</CardTitle>
									</CardHeader>
									<CardContent>
										<Button
											onClick={handleTriggerCall}
											disabled={triggerCallMutation.isPending}
											className="w-full"
										>
											{triggerCallMutation.isPending
												? "Triggering..."
												: "Call Now"}
										</Button>
									</CardContent>
								</Card>

								{/* Schedule Call */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center">
											<CalendarDays className="h-5 w-5 mr-2" />
											Schedule Call
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<div>
											<Label className="text-sm font-medium text-gray-700">
												Date & Time
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
												Note
											</Label>
											<Textarea
												value={scheduleNote}
												onChange={(e) => setScheduleNote(e.target.value)}
												placeholder="Add a note for the scheduled call..."
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
												? "Scheduling..."
												: "Schedule Call"}
										</Button>
									</CardContent>
								</Card>

								{/* Scheduled Call Info */}
								{lead.scheduledCallAt && (
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center">
												<Clock className="h-5 w-5 mr-2" />
												Scheduled Call
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<div>
												<Label className="text-sm font-medium text-gray-700">
													Scheduled For
												</Label>
												<p className="text-gray-900">
													{formatDate(lead.scheduledCallAt)}
												</p>
											</div>
											{lead.scheduledCallNote && (
												<div>
													<Label className="text-sm font-medium text-gray-700">
														Note
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
