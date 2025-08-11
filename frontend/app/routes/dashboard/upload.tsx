"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	Upload,
	FileSpreadsheet,
	CheckCircle,
	AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { socketService } from "~/lib/socket";
import { leadAPI } from "~/services/api";

export default function UploadPage() {
	const { isAuthenticated } = useAuth();
	const { isClient, redirectIfNotAuthenticated } = useClientSideAuth();
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string[][]>([]);
	const [dragActive, setDragActive] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isClient) {
			redirectIfNotAuthenticated("/login");
		}
	}, [isClient, redirectIfNotAuthenticated]);

	const uploadMutation = useMutation({
		mutationFn: (file: File) => leadAPI.uploadLeads(file),
		onSuccess: (data) => {
			if (data.success) {
				setFile(null);
				setPreview([]);
				setUploadProgress(0);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				// Invalidate all relevant queries to refresh data across the app
				queryClient.invalidateQueries({ queryKey: ["leads"] });
				queryClient.invalidateQueries({ queryKey: ["leads-overview"] });
				queryClient.invalidateQueries({ queryKey: ["campaigns"] });
				queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
				queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
				queryClient.invalidateQueries({
					queryKey: ["active-campaigns-overview"],
				});
			}
		},
		onError: (error) => {
			setUploadProgress(0);
			console.error("Upload error:", error);
		},
	});

	useEffect(() => {
		if (isAuthenticated && isClient) {
			// Connect to socket when dashboard loads
			socketService.connect();

			const socket = socketService.getSocket();
			if (socket) {
				// Listen for leads uploaded event to refresh campaign data
				socket.on("leads-uploaded", (data) => {
					console.log("Leads uploaded:", data);
					// Invalidate campaign queries to refresh campaign list
					queryClient.invalidateQueries({ queryKey: ["campaigns"] });
					queryClient.invalidateQueries({ queryKey: ["campaigns-overview"] });
					queryClient.invalidateQueries({ queryKey: ["active-campaigns"] });
					queryClient.invalidateQueries({
						queryKey: ["active-campaigns-overview"],
					});
				});
			}

			return () => {
				if (socket) {
					socket.off("leads-uploaded");
				}
				socketService.disconnect();
			};
		}
	}, [isAuthenticated, isClient, queryClient]);

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

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		const files = e.dataTransfer.files;
		if (files && files[0]) {
			handleFileSelect(files[0]);
		}
	};

	const handleFileSelect = (selectedFile: File) => {
		setFile(selectedFile);

		const fileExtension = selectedFile.name.toLowerCase().split(".").pop();

		if (fileExtension === "csv") {
			// Handle CSV files as text
			const reader = new FileReader();
			reader.onload = (e) => {
				const text = e.target?.result as string;
				const lines = text.split("\n").slice(0, 6); // Show first 5 rows
				const data = lines.map((line) => line.split(","));
				setPreview(data);
			};
			reader.readAsText(selectedFile);
		} else if (fileExtension === "xlsx" || fileExtension === "xls") {
			// Handle Excel files using xlsx library
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const data = new Uint8Array(e.target?.result as ArrayBuffer);
					const workbook = XLSX.read(data, { type: "array" });
					const sheetName = workbook.SheetNames[0];
					const worksheet = workbook.Sheets[sheetName];

					// Convert to array format for preview
					const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
					const previewData = jsonData.slice(0, 6) as string[][];
					setPreview(previewData);
				} catch (error) {
					console.error("Error reading Excel file:", error);
					setPreview([]);
				}
			};
			reader.readAsArrayBuffer(selectedFile);
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files[0]) {
			handleFileSelect(files[0]);
		}
	};

	const handleUpload = () => {
		if (file) {
			setUploadProgress(0);

			// Show progress for CSV files (they take longer)
			const fileExtension = file.name.toLowerCase().split(".").pop();
			if (fileExtension === "csv") {
				// Simulate progress for CSV files
				const progressInterval = setInterval(() => {
					setUploadProgress((prev) => {
						if (prev >= 90) {
							clearInterval(progressInterval);
							return prev;
						}
						return prev + 10;
					});
				}, 500);

				// Clear interval when upload completes
				setTimeout(() => {
					clearInterval(progressInterval);
				}, 30000); // 30 second timeout
			}

			uploadMutation.mutate(file);
		}
	};

	return (
		<div className="flex h-screen bg-gray-100">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Topbar />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-3 sm:p-6">
					<div className="space-y-4 sm:space-y-6">
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-gray-900">
								{t("upload.title")}
							</h1>
							<p className="text-gray-600 text-sm sm:text-base">
								{t("upload.description")}
							</p>
						</div>

						<Card>
							<CardHeader>
								<CardTitle className="text-lg sm:text-xl">
									{t("upload.fileUpload")}
								</CardTitle>
								<CardDescription className="text-sm">
									{t("upload.selectFile")}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div
									className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors ${
										dragActive
											? "border-blue-400 bg-blue-50"
											: "border-gray-300 hover:border-gray-400"
									}`}
									onDragEnter={handleDrag}
									onDragLeave={handleDrag}
									onDragOver={handleDrag}
									onDrop={handleDrop}
								>
									<Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
									<div className="mt-3 sm:mt-4">
										<p className="text-base sm:text-lg font-medium text-gray-900">
											{t("upload.dropFile")}{" "}
											<button
												type="button"
												className="text-blue-600 hover:text-blue-500"
												onClick={() => fileInputRef.current?.click()}
											>
												{t("upload.browse")}
											</button>
										</p>
										<p className="text-xs sm:text-sm text-gray-500 mt-1">
											{t("upload.supportedFormats")}
										</p>
									</div>
									<input
										ref={fileInputRef}
										type="file"
										className="hidden"
										accept=".xlsx,.xls,.csv"
										onChange={handleFileInputChange}
									/>
								</div>

								{file && (
									<div className="space-y-4">
										<div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
											<FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
											<span className="font-medium text-sm sm:text-base">
												{file.name}
											</span>
											<span className="text-xs sm:text-sm text-gray-500">
												({(file.size / 1024).toFixed(1)} KB)
											</span>
										</div>

										{preview.length > 0 && (
											<div>
												<h3 className="font-medium mb-2 text-sm sm:text-base">
													{t("upload.preview")}
												</h3>
												<div className="overflow-x-auto">
													<table className="min-w-full border border-gray-200 rounded-lg">
														<tbody>
															{preview.map((row, i) => (
																<tr
																	key={i}
																	className={
																		i === 0 ? "bg-gray-50 font-medium" : ""
																	}
																>
																	{row.map((cell, j) => (
																		<td
																			key={j}
																			className="px-2 sm:px-3 py-1 sm:py-2 border-r border-gray-200 text-xs sm:text-sm"
																		>
																			{cell}
																		</td>
																	))}
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										)}

										<Button
											onClick={handleUpload}
											disabled={uploadMutation.isPending}
											className="w-full text-sm sm:text-base"
										>
											{uploadMutation.isPending
												? t("upload.uploading")
												: t("upload.uploadFile")}
										</Button>
									</div>
								)}

								{uploadMutation.isPending && (
									<div className="space-y-2">
										<Progress value={uploadProgress} />
										<p className="text-xs sm:text-sm text-gray-600 text-center">
											{file?.name.toLowerCase().endsWith(".csv")
												? t("upload.processingCsv")
												: t("upload.processingFile")}
										</p>
									</div>
								)}

								{uploadMutation.isSuccess && (
									<div className="space-y-3">
										<Alert>
											<CheckCircle className="h-4 w-4" />
											<AlertDescription className="text-sm">
												<strong>{t("upload.uploadSuccess")}</strong>
											</AlertDescription>
										</Alert>

										<div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
											<h4 className="font-medium text-green-800 mb-3 text-sm sm:text-base">
												{t("upload.uploadSummary")}
											</h4>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
												<div>
													<span className="text-green-700 font-medium">
														{t("upload.totalLeadsFound")}
													</span>
													<span className="ml-2 text-green-600">
														{uploadMutation.data?.data?.totalLeads}
													</span>
												</div>
												<div>
													<span className="text-green-700 font-medium">
														{t("upload.leadsImported")}
													</span>
													<span className="ml-2 text-green-600">
														{uploadMutation.data?.data?.leadsProcessed}
													</span>
												</div>
												{uploadMutation.data?.data?.duplicatesSkipped > 0 ? (
													<div className="sm:col-span-2">
														<span className="text-amber-700 font-medium">
															⚠️ {t("upload.duplicatesSkipped")}
														</span>
														<span className="ml-2 text-amber-600">
															{uploadMutation.data?.data?.duplicatesSkipped}
														</span>
													</div>
												) : (
													<div className="sm:col-span-2">
														<span className="text-green-700 font-medium">
															✅ {t("upload.noDuplicates")}
														</span>
													</div>
												)}
												{uploadMutation.data?.data?.campaignsCreated > 0 && (
													<div className="sm:col-span-2">
														<span className="text-blue-700 font-medium">
															📊 {t("upload.campaignsCreated")}
														</span>
														<span className="ml-2 text-blue-600">
															{uploadMutation.data?.data?.campaignsCreated}
														</span>
													</div>
												)}
											</div>
										</div>
									</div>
								)}

								{uploadMutation.isError && (
									<Alert variant="destructive">
										<AlertCircle className="h-4 w-4" />
										<AlertDescription className="text-sm">
											{t("upload.uploadFailed")}
										</AlertDescription>
									</Alert>
								)}
							</CardContent>
						</Card>
					</div>
				</main>
			</div>
		</div>
	);
}
