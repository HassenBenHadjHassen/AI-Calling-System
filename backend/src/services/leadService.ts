import { LeadRepository } from "../repositories/leadRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import { LeadStatus, ScheduledCallStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

export class LeadService {
	private leadRepository: LeadRepository;
	private campaignRepository: CampaignRepository;

	constructor() {
		this.leadRepository = new LeadRepository();
		this.campaignRepository = new CampaignRepository();
	}

	async createManualLead(
		name: string,
		phone1: string,
		phone2?: string,
		address?: string,
		postalCode?: string,
		city?: string
	): Promise<any> {
		try {
			const formattedPhone1 = this.formatPhoneNumber(phone1);
			const formattedPhone2 = phone2
				? this.formatPhoneNumber(phone2)
				: undefined;

			// Check for existing leads with the same phone numbers
			const phoneNumbersToCheck = [formattedPhone1];
			if (formattedPhone2) {
				phoneNumbersToCheck.push(formattedPhone2);
			}
			const existingLeads = await this.checkForExistingLeads(
				phoneNumbersToCheck
			);

			if (existingLeads.length > 0) {
				throw new Error(
					`Lead with phone number already exists: ${existingLeads
						.map((l: any) => l.phone1)
						.join(", ")}`
				);
			}

			return await this.leadRepository.create({
				name,
				phone1: formattedPhone1,
				phone2: formattedPhone2,
				address,
				postalCode,
				city,
			});
		} catch (error: any) {
			throw new Error(`Failed to create manual lead: ${error.message}`);
		}
	}

	async uploadLeadsFromFile(filePath: string): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		try {
			const fileExtension = path.extname(filePath).toLowerCase();

			if (fileExtension === ".csv") {
				return await this.processCSVFile(filePath);
			} else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
				return await this.processExcelFile(filePath);
			} else {
				throw new Error(
					"Unsupported file format. Please upload CSV or Excel files."
				);
			}
		} catch (error: any) {
			throw new Error(`Failed to upload leads from file: ${error.message}`);
		}
	}

	async uploadLeadsFromLargeFile(filePath: string): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		try {
			// For very large files, process in chunks to prevent memory issues
			const fileExtension = path.extname(filePath).toLowerCase();

			if (fileExtension === ".csv") {
				return await this.processLargeCSVFile(filePath);
			} else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
				return await this.processLargeExcelFile(filePath);
			} else {
				throw new Error(
					"Unsupported file format. Please upload CSV or Excel files."
				);
			}
		} catch (error: any) {
			throw new Error(
				`Failed to upload leads from large file: ${error.message}`
			);
		}
	}

	private async processCSVFile(filePath: string): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		const leads: any[] = [];

		return new Promise((resolve, reject) => {
			const csv = require("csv-parser");

			fs.createReadStream(filePath)
				.pipe(csv())
				.on("data", (row: any) => {
					// Map CSV columns to lead data with better validation
					const leadData = {
						name: row.nom || row.name || row.Nom || row.Name,
						address: row.adresse2 || row.address || row.Adresse2 || row.Address,
						postalCode:
							row.codepostal ||
							row.postalCode ||
							row.Codepostal ||
							row.PostalCode,
						city: row.ville || row.city || row.Ville || row.City,
						phone1: row.tel1 || row.phone1 || row.Tel1 || row.Phone1,
						phone2: row.tel2 || row.phone2 || row.Tel2 || row.Phone2,
					};

					// Only add leads with required fields
					if (
						leadData.name &&
						leadData.phone1 &&
						leadData.name.trim() &&
						leadData.phone1.trim()
					) {
						// Clean the data
						leads.push({
							name: leadData.name.trim(),
							address: leadData.address?.trim() || null,
							postalCode: leadData.postalCode?.trim() || null,
							city: leadData.city?.trim() || null,
							phone1: this.formatPhoneNumber(leadData.phone1.trim()),
							phone2: leadData.phone2?.trim()
								? this.formatPhoneNumber(leadData.phone2.trim())
								: null,
						});
					}
				})
				.on("end", async () => {
					try {
						console.log(
							`CSV processing completed. Found ${leads.length} valid leads.`
						);
						const result = await this.processLeads(leads);
						resolve(result);
					} catch (error: any) {
						reject(error);
					}
				})
				.on("error", (error: any) => {
					console.error("CSV processing error:", error);
					reject(error);
				});
		});
	}

	private async processExcelFile(filePath: string): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		try {
			const workbook = XLSX.readFile(filePath);
			const sheetName = workbook.SheetNames[0];
			const worksheet = workbook.Sheets[sheetName];
			const jsonData = XLSX.utils.sheet_to_json(worksheet);

			const leads: any[] = [];

			for (const row of jsonData) {
				const leadData = {
					name:
						(row as any).nom ||
						(row as any).name ||
						(row as any).Nom ||
						(row as any).Name,
					address:
						(row as any).adresse2 ||
						(row as any).address ||
						(row as any).Adresse2 ||
						(row as any).Address,
					postalCode:
						(row as any).codepostal ||
						(row as any).postalCode ||
						(row as any).Codepostal ||
						(row as any).PostalCode,
					city:
						(row as any).ville ||
						(row as any).city ||
						(row as any).Ville ||
						(row as any).City,
					phone1:
						(row as any).tel1 ||
						(row as any).phone1 ||
						(row as any).Tel1 ||
						(row as any).Phone1,
					phone2:
						(row as any).tel2 ||
						(row as any).phone2 ||
						(row as any).Tel2 ||
						(row as any).Phone2,
				};

				// Only add leads with required fields
				if (
					leadData.name &&
					leadData.phone1 &&
					leadData.name.toString().trim() &&
					leadData.phone1.toString().trim()
				) {
					// Clean the data
					leads.push({
						name: leadData.name.toString().trim(),
						address: leadData.address?.toString().trim() || null,
						postalCode: leadData.postalCode?.toString().trim() || null,
						city: leadData.city?.toString().trim() || null,
						phone1: this.formatPhoneNumber(leadData.phone1.toString().trim()),
						phone2: leadData.phone2?.toString().trim()
							? this.formatPhoneNumber(leadData.phone2.toString().trim())
							: null,
					});
				}
			}

			console.log(
				`Excel processing completed. Found ${leads.length} valid leads.`
			);
			return await this.processLeads(leads);
		} catch (error: any) {
			throw new Error(`Error processing Excel file: ${error.message}`);
		}
	}

	private async processLeads(leads: any[]): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		let leadsProcessed = 0;
		let campaignsCreated = 0;
		let duplicatesSkipped = 0;

		// Process leads in larger batches for better performance
		const batchSize = 5;

		for (let i = 0; i < leads.length; i += batchSize) {
			const batch = leads.slice(i, i + batchSize);

			// Filter out duplicates before processing
			const uniqueLeads = await this.filterDuplicateLeads(batch);
			const duplicatesInBatch = batch.length - uniqueLeads.length;
			duplicatesSkipped += duplicatesInBatch;

			if (uniqueLeads.length === 0) {
				continue; // Skip this batch if all leads are duplicates
			}

			// Create a new campaign for this batch
			const campaign = await this.campaignRepository.create({
				name: `Campaign ${Date.now()}-${campaignsCreated + 1}`,
			});
			campaignsCreated++;

			// Prepare bulk data for all leads in this batch
			const bulkLeadData = uniqueLeads.map((leadData) => ({
				...leadData,
				campaignId: campaign.id,
			}));

			// Use bulk create for better performance
			await this.leadRepository.createMany(bulkLeadData);
			leadsProcessed += uniqueLeads.length;
		}

		return {
			totalLeads: leads.length,
			campaignsCreated,
			leadsProcessed,
			duplicatesSkipped,
		};
	}

	/**
	 * Format phone number to E.164 format for Vapi.ai
	 */
	private formatPhoneNumber(phone: string): string {
		if (!phone) {
			throw new Error("Phone number is required");
		}

		// Remove all non-digit characters except +
		let cleaned = phone.replace(/[^\d+]/g, "");

		// Already valid E.164 format
		if (cleaned.startsWith("+")) {
			return cleaned;
		}

		// ---------- Tunisian formats ----------
		const tunisianMobileWithZero = cleaned.match(/^0(2\d{7})$/);
		if (tunisianMobileWithZero) {
			return `+216${tunisianMobileWithZero[1]}`;
		}

		const tunisianLandlineWithZero = cleaned.match(/^0(7\d{7})$/);
		if (tunisianLandlineWithZero) {
			return `+216${tunisianLandlineWithZero[1]}`;
		}

		if (cleaned.length === 8 && /^[27]/.test(cleaned)) {
			return `+216${cleaned}`;
		}

		if (
			(cleaned.length === 10 || cleaned.length === 11) &&
			cleaned.startsWith("216")
		) {
			return `+${cleaned}`;
		}

		// ---------- French formats ----------
		const frenchWithZero = cleaned.match(/^0(\d{9})$/);
		if (frenchWithZero) {
			return `+33${frenchWithZero[1]}`;
		}

		if (cleaned.length === 9 && /^\d{9}$/.test(cleaned)) {
			return `+33${cleaned}`;
		}

		if (cleaned.length === 10 && cleaned.startsWith("0")) {
			return `+33${cleaned.substring(1)}`;
		}

		if (cleaned.length === 10 && !cleaned.startsWith("0")) {
			return `+33${cleaned}`;
		}

		if (cleaned.length === 11 && cleaned.startsWith("33")) {
			return `+${cleaned}`;
		}

		// ---------- US formats ----------
		// US numbers are typically 10 digits (area code + 7-digit number)
		if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
			return `+1${cleaned}`;
		}

		// US numbers with country code already (1 + 10 digits)
		if (cleaned.length === 11 && cleaned.startsWith("1")) {
			return `+${cleaned}`;
		}

		// ---------- Fallback ----------
		return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
	}

	private async checkForExistingLeads(phoneNumbers: string[]): Promise<any[]> {
		if (phoneNumbers.length === 0) return [];

		return this.leadRepository.findExistingLeads(phoneNumbers);
	}

	private async filterDuplicateLeads(leads: any[]): Promise<any[]> {
		if (leads.length === 0) return [];

		// Extract all phone numbers from the leads
		const phoneNumbers: string[] = [];
		leads.forEach((lead) => {
			if (lead.phone1) phoneNumbers.push(lead.phone1);
			if (lead.phone2) phoneNumbers.push(lead.phone2);
		});

		// Find existing leads with these phone numbers
		const existingLeads = await this.leadRepository.findExistingLeads(
			phoneNumbers
		);
		const existingPhoneNumbers = new Set<string>();

		existingLeads.forEach((lead) => {
			if (lead.phone1) existingPhoneNumbers.add(lead.phone1);
			if (lead.phone2) existingPhoneNumbers.add(lead.phone2);
		});

		// Filter out leads that have phone numbers already in the database
		return leads.filter((lead) => {
			const hasExistingPhone1 =
				lead.phone1 && existingPhoneNumbers.has(lead.phone1);
			const hasExistingPhone2 =
				lead.phone2 && existingPhoneNumbers.has(lead.phone2);
			return !hasExistingPhone1 && !hasExistingPhone2;
		});
	}

	private async processLargeCSVFile(filePath: string): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		let totalLeads = 0;
		let campaignsCreated = 0;
		let leadsProcessed = 0;
		let duplicatesSkipped = 0;
		const chunkSize = 1000; // Process 1000 leads at a time
		let currentChunk: any[] = [];

		return new Promise((resolve, reject) => {
			const csv = require("csv-parser");

			fs.createReadStream(filePath)
				.pipe(csv())
				.on("data", async (row: any) => {
					// Map CSV columns to lead data with better validation
					const leadData = {
						name: row.nom || row.name || row.Nom || row.Name,
						address: row.adresse2 || row.address || row.Adresse2 || row.Address,
						postalCode:
							row.codepostal ||
							row.postalCode ||
							row.Codepostal ||
							row.PostalCode,
						city: row.ville || row.city || row.Ville || row.City,
						phone1: row.tel1 || row.phone1 || row.Tel1 || row.Phone1,
						phone2: row.tel2 || row.phone2 || row.Tel2 || row.Phone2,
					};

					// Only add leads with required fields
					if (
						leadData.name &&
						leadData.phone1 &&
						leadData.name.trim() &&
						leadData.phone1.trim()
					) {
						currentChunk.push({
							name: leadData.name.trim(),
							address: leadData.address?.trim() || null,
							postalCode: leadData.postalCode?.trim() || null,
							city: leadData.city?.trim() || null,
							phone1: this.formatPhoneNumber(leadData.phone1.trim()),
							phone2: leadData.phone2?.trim()
								? this.formatPhoneNumber(leadData.phone2.trim())
								: null,
						});
						totalLeads++;

						// Process chunk when it reaches the size limit
						if (currentChunk.length >= chunkSize) {
							const chunk = [...currentChunk];
							currentChunk = [];

							try {
								const result = await this.processLeads(chunk);
								campaignsCreated += result.campaignsCreated;
								leadsProcessed += result.leadsProcessed;
								duplicatesSkipped += result.duplicatesSkipped;
								console.log(
									`Processed chunk: ${result.leadsProcessed} leads, Skipped: ${result.duplicatesSkipped} duplicates`
								);
							} catch (error) {
								reject(error);
								return;
							}
						}
					}
				})
				.on("end", async () => {
					try {
						// Process remaining leads
						if (currentChunk.length > 0) {
							const result = await this.processLeads(currentChunk);
							campaignsCreated += result.campaignsCreated;
							leadsProcessed += result.leadsProcessed;
							duplicatesSkipped += result.duplicatesSkipped;
						}

						console.log(
							`Large CSV processing completed. Total: ${totalLeads} leads, Processed: ${leadsProcessed}, Skipped: ${duplicatesSkipped} duplicates`
						);
						resolve({
							totalLeads,
							campaignsCreated,
							leadsProcessed,
							duplicatesSkipped,
						});
					} catch (error: any) {
						reject(error);
					}
				})
				.on("error", (error: any) => {
					console.error("Large CSV processing error:", error);
					reject(error);
				});
		});
	}

	private async processLargeExcelFile(filePath: string): Promise<{
		totalLeads: number;
		campaignsCreated: number;
		leadsProcessed: number;
		duplicatesSkipped: number;
	}> {
		try {
			const workbook = XLSX.readFile(filePath);
			const sheetName = workbook.SheetNames[0];
			const worksheet = workbook.Sheets[sheetName];
			const jsonData = XLSX.utils.sheet_to_json(worksheet);

			let totalLeads = 0;
			let campaignsCreated = 0;
			let leadsProcessed = 0;
			let duplicatesSkipped = 0;
			const chunkSize = 1000;
			let currentChunk: any[] = [];

			for (const row of jsonData) {
				const leadData = {
					name:
						(row as any).nom ||
						(row as any).name ||
						(row as any).Nom ||
						(row as any).Name,
					address:
						(row as any).adresse2 ||
						(row as any).address ||
						(row as any).Adresse2 ||
						(row as any).Address,
					postalCode:
						(row as any).codepostal ||
						(row as any).postalCode ||
						(row as any).Codepostal ||
						(row as any).PostalCode,
					city:
						(row as any).ville ||
						(row as any).city ||
						(row as any).Ville ||
						(row as any).City,
					phone1:
						(row as any).tel1 ||
						(row as any).phone1 ||
						(row as any).Tel1 ||
						(row as any).Phone1,
					phone2:
						(row as any).tel2 ||
						(row as any).phone2 ||
						(row as any).Tel2 ||
						(row as any).Phone2,
				};

				// Only add leads with required fields
				if (
					leadData.name &&
					leadData.phone1 &&
					leadData.name.toString().trim() &&
					leadData.phone1.toString().trim()
				) {
					currentChunk.push({
						name: leadData.name.toString().trim(),
						address: leadData.address?.toString().trim() || null,
						postalCode: leadData.postalCode?.toString().trim() || null,
						city: leadData.city?.toString().trim() || null,
						phone1: this.formatPhoneNumber(leadData.phone1.toString().trim()),
						phone2: leadData.phone2?.toString().trim()
							? this.formatPhoneNumber(leadData.phone2.toString().trim())
							: null,
					});
					totalLeads++;

					// Process chunk when it reaches the size limit
					if (currentChunk.length >= chunkSize) {
						const chunk = [...currentChunk];
						currentChunk = [];

						const result = await this.processLeads(chunk);
						campaignsCreated += result.campaignsCreated;
						leadsProcessed += result.leadsProcessed;
						duplicatesSkipped += result.duplicatesSkipped;
						console.log(
							`Processed Excel chunk: ${result.leadsProcessed} leads, Skipped: ${result.duplicatesSkipped} duplicates`
						);
					}
				}
			}

			// Process remaining leads
			if (currentChunk.length > 0) {
				const result = await this.processLeads(currentChunk);
				campaignsCreated += result.campaignsCreated;
				leadsProcessed += result.leadsProcessed;
				duplicatesSkipped += result.duplicatesSkipped;
			}

			console.log(
				`Large Excel processing completed. Total: ${totalLeads} leads, Processed: ${leadsProcessed}, Skipped: ${duplicatesSkipped} duplicates`
			);
			return {
				totalLeads,
				campaignsCreated,
				leadsProcessed,
				duplicatesSkipped,
			};
		} catch (error: any) {
			throw new Error(`Error processing large Excel file: ${error.message}`);
		}
	}

	async updateLeadStatus(leadId: string, status: LeadStatus): Promise<any> {
		try {
			const lead = await this.leadRepository.findById(leadId);
			if (!lead) {
				throw new Error("Lead not found");
			}

			// If lead is being rescheduled, remove from current campaign
			if (status === LeadStatus.SCHEDULED && lead.campaignId) {
				await this.campaignRepository.removeLead(lead.campaignId, leadId);
			}

			return await this.leadRepository.updateStatus(leadId, status);
		} catch (error: any) {
			throw new Error(`Failed to update lead status: ${error.message}`);
		}
	}

	async updateLead(
		leadId: string,
		data: {
			name?: string;
			address?: string;
			postalCode?: string;
			city?: string;
			phone1?: string;
			phone2?: string;
		}
	): Promise<any> {
		try {
			const lead = await this.leadRepository.findById(leadId);
			if (!lead) {
				throw new Error("Lead not found");
			}

			return await this.leadRepository.update(leadId, data);
		} catch (error: any) {
			throw new Error(`Failed to update lead: ${error.message}`);
		}
	}

	async scheduleCall(
		customerPhoneNumber: string,
		scheduledCallAt: Date,
		note?: string
	): Promise<any> {
		try {
			const formattedPhone = this.formatPhoneNumber(customerPhoneNumber);

			// Check if lead exists
			const existingLead = await this.leadRepository.findByPhone(
				formattedPhone
			);
			if (!existingLead) {
				throw new Error("Lead not found with this phone number");
			}

			// Check if lead is blacklisted
			if (existingLead.blacklisted) {
				throw new Error("Cannot schedule call for blacklisted lead");
			}

			// Check if call is already scheduled
			if (existingLead.scheduledCallAt) {
				throw new Error("Call is already scheduled for this lead");
			}

			// Remove from current campaign if exists
			if (existingLead.campaignId) {
				await this.campaignRepository.removeLeadByPhone(
					existingLead.campaignId,
					customerPhoneNumber
				);
			}

			return await this.leadRepository.updateScheduledCallByPhone(
				formattedPhone,
				scheduledCallAt,
				note
			);
		} catch (error: any) {
			throw new Error(`Failed to schedule call: ${error.message}`);
		}
	}

	async blacklistLead(customerPhoneNumber: string): Promise<any> {
		try {
			const formattedPhone = this.formatPhoneNumber(customerPhoneNumber);

			// Check if lead exists
			const existingLead = await this.leadRepository.findByPhone(
				formattedPhone
			);
			if (!existingLead) {
				throw new Error("Lead not found with this phone number");
			}

			// Check if lead is already blacklisted
			if (existingLead.blacklisted) {
				throw new Error("Lead is already blacklisted");
			}

			// Remove from current campaign if exists
			if (existingLead.campaignId) {
				await this.campaignRepository.removeLeadByPhone(
					existingLead.campaignId,
					customerPhoneNumber
				);
			}

			return await this.leadRepository.blacklistByPhone(formattedPhone);
		} catch (error: any) {
			throw new Error(`Failed to blacklist lead: ${error.message}`);
		}
	}

	async getLeadsByStatus(status?: LeadStatus): Promise<any[]> {
		try {
			if (status) {
				return await this.leadRepository.findByStatus(status);
			} else {
				return await this.leadRepository.findAll();
			}
		} catch (error: any) {
			throw new Error(`Failed to get leads by status: ${error.message}`);
		}
	}

	async getScheduledCalls(): Promise<any[]> {
		try {
			return await this.leadRepository.findScheduledCalls();
		} catch (error: any) {
			throw new Error(`Failed to get scheduled calls: ${error.message}`);
		}
	}

	async getDueScheduledCalls(): Promise<any[]> {
		try {
			return await this.leadRepository.findDueScheduledCalls();
		} catch (error: any) {
			throw new Error(`Failed to get due scheduled calls: ${error.message}`);
		}
	}

	async getAvailableLeadsForCampaign(): Promise<any[]> {
		try {
			return await this.leadRepository.findAvailableForCampaign();
		} catch (error: any) {
			throw new Error(
				`Failed to get available leads for campaign: ${error.message}`
			);
		}
	}

	async cleanupOrphanedLeads(): Promise<{ cleanedCount: number }> {
		try {
			const cleanedCount = await this.leadRepository.cleanupOrphanedLeads();
			return { cleanedCount };
		} catch (error: any) {
			throw new Error(`Failed to cleanup orphaned leads: ${error.message}`);
		}
	}

	async getLeadById(leadId: string): Promise<any> {
		try {
			return await this.leadRepository.findById(leadId);
		} catch (error: any) {
			throw new Error(`Failed to get lead by ID: ${error.message}`);
		}
	}

	async getLeadByPhone(phone: string): Promise<any> {
		try {
			return await this.leadRepository.findByPhone(phone);
		} catch (error: any) {
			throw new Error(`Failed to get lead by phone: ${error.message}`);
		}
	}

	async cleanAllLeads(): Promise<{ deletedCount: number }> {
		try {
			const deletedCount = await this.leadRepository.deleteAll();
			return { deletedCount };
		} catch (error: any) {
			throw new Error(`Failed to clean all leads: ${error.message}`);
		}
	}

	async deleteLead(leadId: string): Promise<any> {
		try {
			const lead = await this.leadRepository.findById(leadId);
			if (!lead) {
				throw new Error("Lead not found");
			}

			await this.leadRepository.deleteById(leadId);
			return { message: "Lead deleted successfully" };
		} catch (error: any) {
			throw new Error(`Failed to delete lead: ${error.message}`);
		}
	}

	async deleteLeads(leadIds: string[]): Promise<any> {
		try {
			if (leadIds.length === 0) {
				throw new Error("No lead IDs provided");
			}

			// Verify all leads exist
			const existingLeads = await this.leadRepository.findByIds(leadIds);
			if (existingLeads.length !== leadIds.length) {
				throw new Error("Some leads not found");
			}

			const deletedCount = await this.leadRepository.deleteByIds(leadIds);
			return {
				message: `${deletedCount} leads deleted successfully`,
				deletedCount,
			};
		} catch (error: any) {
			throw new Error(`Failed to delete leads: ${error.message}`);
		}
	}

	async getProcessingStats(): Promise<{
		totalLeads: number;
		recentUploads: number;
		averageProcessingTime: number;
	}> {
		try {
			const totalLeads = await this.leadRepository.count();
			const recentCampaigns = await this.campaignRepository.countRecent();

			return {
				totalLeads,
				recentUploads: recentCampaigns,
				averageProcessingTime: 0, // This could be calculated based on actual processing times
			};
		} catch (error: any) {
			throw new Error(`Failed to get processing statistics: ${error.message}`);
		}
	}

	async getLeadStatistics(): Promise<{
		totalLeads: number;
		leadsByStatus: Record<string, number>;
		availableLeads: number;
		blacklistedLeads: number;
		scheduledLeads: number;
		orphanedLeads: number;
	}> {
		try {
			const allLeads = await this.leadRepository.findAll();
			const availableLeads =
				await this.leadRepository.findAvailableForCampaign();

			// Count leads by status
			const leadsByStatus: Record<string, number> = {};
			allLeads.forEach((lead) => {
				leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;
			});

			// Count orphaned leads (leads with campaignId but no campaign)
			const orphanedLeads = allLeads.filter(
				(lead) => lead.campaignId && !(lead as any).campaign
			);

			return {
				totalLeads: allLeads.length,
				leadsByStatus,
				availableLeads: availableLeads.length,
				blacklistedLeads: allLeads.filter((lead) => lead.blacklisted).length,
				scheduledLeads: allLeads.filter((lead) => lead.scheduledCallAt).length,
				orphanedLeads: orphanedLeads.length,
			};
		} catch (error: any) {
			throw new Error(`Failed to get lead statistics: ${error.message}`);
		}
	}

	async resetLeadsForTesting(): Promise<{ resetCount: number }> {
		try {
			// Reset all leads to NEW status and remove them from campaigns
			// This is useful for testing purposes
			const result = await this.leadRepository.resetAllLeads();
			return { resetCount: result.count };
		} catch (error: any) {
			throw new Error(`Failed to reset leads for testing: ${error.message}`);
		}
	}

	async debugLeadAvailability(): Promise<{
		totalLeads: number;
		leadsByStatus: Record<string, number>;
		leadsByCampaignId: Record<string, number>;
		blacklistedLeads: number;
		scheduledLeads: number;
		availableLeads: number;
	}> {
		try {
			return await this.leadRepository.debugLeadAvailability();
		} catch (error: any) {
			throw new Error(`Failed to debug lead availability: ${error.message}`);
		}
	}

	async getOrphanedScheduledCalls(): Promise<any[]> {
		try {
			return await this.leadRepository.findOrphanedScheduledCalls();
		} catch (error: any) {
			throw new Error(
				`Failed to get orphaned scheduled calls: ${error.message}`
			);
		}
	}

	async reassignOrphanedScheduledCall(
		leadId: string,
		campaignId: string
	): Promise<any> {
		try {
			// Verify the campaign exists and has capacity
			const campaign = await this.campaignRepository.findById(campaignId);
			if (!campaign) {
				throw new Error("Campaign not found");
			}

			// Check if campaign has capacity (leads array is included in findById)
			if ((campaign as any).leads && (campaign as any).leads.length >= 5) {
				throw new Error("Campaign is full (maximum 5 leads)");
			}

			return await this.leadRepository.reassignOrphanedScheduledCall(
				leadId,
				campaignId
			);
		} catch (error: any) {
			throw new Error(
				`Failed to reassign orphaned scheduled call: ${error.message}`
			);
		}
	}

	async getOrphanedScheduledCallsCount(): Promise<number> {
		try {
			return await this.leadRepository.getOrphanedScheduledCallsCount();
		} catch (error: any) {
			throw new Error(
				`Failed to get orphaned scheduled calls count: ${error.message}`
			);
		}
	}
}
