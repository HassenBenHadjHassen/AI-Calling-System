"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Search, Filter, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { socketService } from "~/lib/socket";
import { formatDate, formatPhoneNumber } from "~/lib/utils";
import { type LeadStatus, leadAPI } from "~/services/api";

const statusColors: Record<LeadStatus, string> = {
	NEW: "default",
	CALLED: "secondary",
	INTERESTED: "default",
	TRANSFERRED: "outline",
	FAILED: "destructive",
	BLACKLISTED: "destructive",
	SCHEDULED: "outline",
};

export default function LeadsPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
	const [currentPage, setCurrentPage] = useState(1);
	const [showCleanWarning, setShowCleanWarning] = useState(false);
	const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
	const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
	const itemsPerPage = 10;

	// Reset current page when status filter or search term changes
	useEffect(() => {
		setCurrentPage(1);
	}, [statusFilter, searchTerm]);

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

	const { data: leads, isLoading } = useQuery({
		queryKey: ["leads", statusFilter === "ALL" ? undefined : statusFilter],
		queryFn: () =>
			leadAPI.getLeads(statusFilter === "ALL" ? undefined : statusFilter),
		enabled: isAuthenticated, // Only run query when authenticated
	});

	// Ensure current page is valid after filtering
	useEffect(() => {
		if (leads?.data) {
			const filteredLeads = leads.data.filter(
				(lead) =>
					lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					lead.phone1.includes(searchTerm)
			);
			const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
			const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
			if (validCurrentPage !== currentPage && totalPages > 0) {
				setCurrentPage(validCurrentPage);
			}
		}
	}, [leads?.data, searchTerm, currentPage, itemsPerPage]);

	const cleanAllLeadsMutation = useMutation({
		mutationFn: () => leadAPI.cleanAllLeads(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setShowCleanWarning(false);
		},
	});

	const deleteLeadMutation = useMutation({
		mutationFn: (leadId: string) => leadAPI.deleteLead(leadId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setDeletingLeadId(null);
		},
		onError: () => {
			setDeletingLeadId(null);
		},
	});

	const deleteLeadsMutation = useMutation({
		mutationFn: (leadIds: string[]) => leadAPI.deleteLeads(leadIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setSelectedLeads([]);
		},
	});

	const handleCleanAllLeads = () => {
		setShowCleanWarning(true);
	};

	const handleDeleteLead = (leadId: string, leadName: string) => {
		if (
			confirm(
				`${t(
					"leads.confirmDeleteLead"
				)} "${leadName}"? This action cannot be undone.`
			)
		) {
			setDeletingLeadId(leadId);
			deleteLeadMutation.mutate(leadId);
		}
	};

	const handleDeleteSelectedLeads = () => {
		if (selectedLeads.length === 0) return;

		const leadNames = paginatedLeads
			.filter((lead) => selectedLeads.includes(lead.id))
			.map((lead) => lead.name)
			.join(", ");

		if (
			confirm(
				`${t("leads.confirmDeleteSelected")} ${selectedLeads.length} ${t(
					"leads.selectedLeads"
				)}\n\n${t(
					"leads.selected"
				)} ${leadNames}\n\nThis action cannot be undone.`
			)
		) {
			deleteLeadsMutation.mutate(selectedLeads);
		}
	};

	const handleSelectLead = (leadId: string) => {
		setSelectedLeads((prev) =>
			prev.includes(leadId)
				? prev.filter((id) => id !== leadId)
				: [...prev, leadId]
		);
	};

	const handleSelectAll = () => {
		if (selectedLeads.length === paginatedLeads.length) {
			setSelectedLeads([]);
		} else {
			setSelectedLeads(paginatedLeads.map((lead) => lead.id));
		}
	};

	const confirmCleanAllLeads = () => {
		cleanAllLeadsMutation.mutate();
	};

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

	const filteredLeads =
		leads?.data?.filter(
			(lead) =>
				lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				lead.phone1.includes(searchTerm)
		) || [];

	const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedLeads = filteredLeads.slice(
		startIndex,
		startIndex + itemsPerPage
	);

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
									{t("leads.title")}
								</h1>
								<p className="text-gray-600">{t("leads.description")}</p>
							</div>
							<div className="flex space-x-2">
								{selectedLeads.length > 0 && (
									<Button
										variant="destructive"
										onClick={handleDeleteSelectedLeads}
										disabled={deleteLeadsMutation.isPending}
									>
										<Trash2 className="h-4 w-4 mr-2" />
										{t("leads.deleteSelected")} ({selectedLeads.length})
									</Button>
								)}
								<Button
									variant="destructive"
									onClick={handleCleanAllLeads}
									disabled={cleanAllLeadsMutation.isPending}
								>
									<Trash2 className="h-4 w-4 mr-2" />
									{t("leads.cleanAllLeads")}
								</Button>
							</div>
						</div>

						{showCleanWarning && (
							<Card className="border-red-200 bg-red-50">
								<CardHeader>
									<CardTitle className="text-red-800">
										{t("leads.dangerZone")}
									</CardTitle>
									<CardContent className="text-red-700">
										<div className="space-y-3">
											<p className="font-semibold">
												{t("leads.confirmDeleteAll")}
											</p>
											<div className="text-sm space-y-2">
												<p>{t("leads.deleteWarning")}</p>
												<ul className="list-disc list-inside space-y-1 ml-4">
													<li>{t("leads.allLeadRecords")}</li>
													<li>{t("leads.allCallHistory")}</li>
													<li>{t("leads.allScheduledCalls")}</li>
													<li>{t("leads.allStatusData")}</li>
												</ul>
												<p className="font-semibold text-red-800">
													{t("leads.cannotUndo")}
												</p>
											</div>
											<div className="flex space-x-2 pt-2">
												<Button
													variant="destructive"
													onClick={confirmCleanAllLeads}
													disabled={cleanAllLeadsMutation.isPending}
												>
													{cleanAllLeadsMutation.isPending
														? t("leads.deleting")
														: t("leads.yesDeleteAll")}
												</Button>
												<Button
													variant="outline"
													onClick={() => setShowCleanWarning(false)}
													disabled={cleanAllLeadsMutation.isPending}
												>
													{t("common.cancel")}
												</Button>
											</div>
										</div>
									</CardContent>
								</CardHeader>
							</Card>
						)}

						<Card>
							<CardHeader>
								<CardTitle>
									{t("leads.leadsCount")} ({filteredLeads.length})
								</CardTitle>
								<div className="flex flex-col sm:flex-row gap-4">
									<div className="relative flex-1">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
										<Input
											placeholder={t("leads.searchPlaceholder")}
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											className="pl-10"
										/>
									</div>
									<Select
										value={statusFilter}
										onValueChange={(value) =>
											setStatusFilter(value as LeadStatus | "ALL")
										}
									>
										<SelectTrigger className="w-48">
											<Filter className="h-4 w-4 mr-2" />
											<SelectValue placeholder={t("leads.filterByStatus")} />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ALL">
												{t("leads.allStatus")}
											</SelectItem>
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
											<SelectItem value="SCHEDULED">
												{t("leads.scheduled")}
											</SelectItem>
											<SelectItem value="BLACKLISTED">
												{t("leads.blacklisted")}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="text-center py-8">
										{t("leads.loadingLeads")}
									</div>
								) : (
									<>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>
														<input
															type="checkbox"
															checked={
																selectedLeads.length ===
																	paginatedLeads.length &&
																paginatedLeads.length > 0
															}
															onChange={handleSelectAll}
															className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
														/>
													</TableHead>
													<TableHead>{t("common.name")}</TableHead>
													<TableHead>{t("common.phone")}</TableHead>
													<TableHead>{t("common.status")}</TableHead>
													<TableHead>{t("common.city")}</TableHead>
													<TableHead>{t("common.created")}</TableHead>
													<TableHead>{t("common.actions")}</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{paginatedLeads.map((lead) => (
													<TableRow key={lead.id}>
														<TableCell>
															<input
																type="checkbox"
																checked={selectedLeads.includes(lead.id)}
																onChange={() => handleSelectLead(lead.id)}
																className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
															/>
														</TableCell>
														<TableCell className="font-medium">
															{lead.name}
														</TableCell>
														<TableCell>
															{formatPhoneNumber(lead.phone1)}
														</TableCell>
														<TableCell>
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
														</TableCell>
														<TableCell>{lead.city || "N/A"}</TableCell>
														<TableCell>{formatDate(lead.createdAt)}</TableCell>
														<TableCell>
															<div className="flex space-x-2">
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() =>
																		navigate(`/dashboard/leads/${lead.id}`)
																	}
																>
																	{t("common.view")}
																</Button>
																<Button
																	variant="destructive"
																	size="sm"
																	onClick={() =>
																		handleDeleteLead(lead.id, lead.name)
																	}
																	disabled={deletingLeadId === lead.id}
																>
																	{deletingLeadId === lead.id
																		? t("leads.deleting")
																		: t("common.delete")}
																</Button>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>

										{totalPages > 1 && (
											<div className="flex items-center justify-between mt-4">
												<p className="text-sm text-gray-600">
													{t("leads.showing")} {startIndex + 1} {t("leads.to")}{" "}
													{Math.min(
														startIndex + itemsPerPage,
														filteredLeads.length
													)}{" "}
													{t("leads.of")} {filteredLeads.length}{" "}
													{t("leads.results")}
												</p>
												<div className="flex space-x-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															setCurrentPage((prev) => Math.max(prev - 1, 1))
														}
														disabled={currentPage === 1}
													>
														{t("common.previous")}
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															setCurrentPage((prev) =>
																Math.min(prev + 1, totalPages)
															)
														}
														disabled={currentPage === totalPages}
													>
														{t("common.next")}
													</Button>
												</div>
											</div>
										)}
									</>
								)}
							</CardContent>
						</Card>
					</div>
				</main>
			</div>
		</div>
	);
}
