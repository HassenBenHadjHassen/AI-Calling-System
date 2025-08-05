"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
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
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
	const [currentPage, setCurrentPage] = useState(1);
	const [showCleanWarning, setShowCleanWarning] = useState(false);
	const itemsPerPage = 10;

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

	const cleanAllLeadsMutation = useMutation({
		mutationFn: () => leadAPI.cleanAllLeads(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setShowCleanWarning(false);
		},
	});

	const handleCleanAllLeads = () => {
		setShowCleanWarning(true);
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
									Leads Management
								</h1>
								<p className="text-gray-600">Manage and track your leads</p>
							</div>
							<Button
								variant="destructive"
								onClick={handleCleanAllLeads}
								disabled={cleanAllLeadsMutation.isPending}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Clean All Leads
							</Button>
						</div>

						{showCleanWarning && (
							<Card className="border-red-200 bg-red-50">
								<CardHeader>
									<CardTitle className="text-red-800">⚠️ Danger Zone</CardTitle>
									<CardContent className="text-red-700">
										<div className="space-y-3">
											<p className="font-semibold">
												Are you absolutely sure you want to delete ALL leads?
											</p>
											<div className="text-sm space-y-2">
												<p>This action will permanently delete:</p>
												<ul className="list-disc list-inside space-y-1 ml-4">
													<li>All lead records in the database</li>
													<li>All associated call history</li>
													<li>All scheduled calls and notes</li>
													<li>All lead status and progress data</li>
												</ul>
												<p className="font-semibold text-red-800">
													⚠️ This action cannot be undone!
												</p>
											</div>
											<div className="flex space-x-2 pt-2">
												<Button
													variant="destructive"
													onClick={confirmCleanAllLeads}
													disabled={cleanAllLeadsMutation.isPending}
												>
													{cleanAllLeadsMutation.isPending
														? "Deleting..."
														: "Yes, Delete All Leads"}
												</Button>
												<Button
													variant="outline"
													onClick={() => setShowCleanWarning(false)}
													disabled={cleanAllLeadsMutation.isPending}
												>
													Cancel
												</Button>
											</div>
										</div>
									</CardContent>
								</CardHeader>
							</Card>
						)}

						<Card>
							<CardHeader>
								<CardTitle>Leads ({filteredLeads.length})</CardTitle>
								<div className="flex flex-col sm:flex-row gap-4">
									<div className="relative flex-1">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
										<Input
											placeholder="Search by name or phone..."
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
											<SelectValue placeholder="Filter by status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ALL">All Status</SelectItem>
											<SelectItem value="NEW">New</SelectItem>
											<SelectItem value="CALLED">Called</SelectItem>
											<SelectItem value="INTERESTED">Interested</SelectItem>
											<SelectItem value="TRANSFERRED">Transferred</SelectItem>
											<SelectItem value="FAILED">Failed</SelectItem>
											<SelectItem value="SCHEDULED">Scheduled</SelectItem>
											<SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="text-center py-8">Loading leads...</div>
								) : (
									<>
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
												{paginatedLeads.map((lead) => (
													<TableRow key={lead.id}>
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
																{lead.status}
															</Badge>
														</TableCell>
														<TableCell>{lead.city || "N/A"}</TableCell>
														<TableCell>{formatDate(lead.createdAt)}</TableCell>
														<TableCell>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	navigate(`/dashboard/leads/${lead.id}`)
																}
															>
																View
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>

										{totalPages > 1 && (
											<div className="flex items-center justify-between mt-4">
												<p className="text-sm text-gray-600">
													Showing {startIndex + 1} to{" "}
													{Math.min(
														startIndex + itemsPerPage,
														filteredLeads.length
													)}{" "}
													of {filteredLeads.length} results
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
														Previous
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
														Next
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
