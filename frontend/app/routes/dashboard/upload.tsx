"use client";

import type React from "react";

import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
	Upload,
	FileSpreadsheet,
	CheckCircle,
	AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "~/components/ui/card";
import { leadAPI } from "~/services/api";
import { Progress } from "~/components/ui/progress";

export default function UploadPage() {
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string[][]>([]);
	const [dragActive, setDragActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadMutation = useMutation({
		mutationFn: (file: File) => leadAPI.uploadLeads(file),
		onSuccess: (data) => {
			if (data.success) {
				setFile(null);
				setPreview([]);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		},
	});

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

		// Simple CSV/Excel preview (mock implementation)
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			const lines = text.split("\n").slice(0, 5); // Show first 5 rows
			const data = lines.map((line) => line.split(","));
			setPreview(data);
		};
		reader.readAsText(selectedFile);
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files[0]) {
			handleFileSelect(files[0]);
		}
	};

	const handleUpload = () => {
		if (file) {
			uploadMutation.mutate(file);
		}
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Upload Leads</h1>
				<p className="text-gray-600">
					Upload Excel or CSV files containing lead information
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>File Upload</CardTitle>
					<CardDescription>
						Select or drag and drop your Excel/CSV file containing leads data
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div
						className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
							dragActive
								? "border-blue-400 bg-blue-50"
								: "border-gray-300 hover:border-gray-400"
						}`}
						onDragEnter={handleDrag}
						onDragLeave={handleDrag}
						onDragOver={handleDrag}
						onDrop={handleDrop}
					>
						<Upload className="mx-auto h-12 w-12 text-gray-400" />
						<div className="mt-4">
							<p className="text-lg font-medium text-gray-900">
								Drop your file here, or{" "}
								<button
									type="button"
									className="text-blue-600 hover:text-blue-500"
									onClick={() => fileInputRef.current?.click()}
								>
									browse
								</button>
							</p>
							<p className="text-sm text-gray-500 mt-1">
								Supports Excel (.xlsx) and CSV (.csv) files
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
								<FileSpreadsheet className="h-5 w-5 text-green-600" />
								<span className="font-medium">{file.name}</span>
								<span className="text-sm text-gray-500">
									({(file.size / 1024).toFixed(1)} KB)
								</span>
							</div>

							{preview.length > 0 && (
								<div>
									<h3 className="font-medium mb-2">Preview (first 5 rows):</h3>
									<div className="overflow-x-auto">
										<table className="min-w-full border border-gray-200 rounded-lg">
											<tbody>
												{preview.map((row, i) => (
													<tr
														key={i}
														className={i === 0 ? "bg-gray-50 font-medium" : ""}
													>
														{row.map((cell, j) => (
															<td
																key={j}
																className="px-3 py-2 border-r border-gray-200 text-sm"
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
								className="w-full"
							>
								{uploadMutation.isPending ? "Uploading..." : "Upload File"}
							</Button>
						</div>
					)}

					{uploadMutation.isPending && (
						<div className="space-y-2">
							<Progress value={50} />
							<p className="text-sm text-gray-600 text-center">
								Uploading and processing file...
							</p>
						</div>
					)}

					{uploadMutation.isSuccess && (
						<Alert>
							<CheckCircle className="h-4 w-4" />
							<AlertDescription>
								File uploaded successfully!{" "}
								{uploadMutation.data?.data?.uploadedCount} leads were imported.
							</AlertDescription>
						</Alert>
					)}

					{uploadMutation.isError && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								Failed to upload file. Please try again.
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
