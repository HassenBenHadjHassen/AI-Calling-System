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
    return this.leadRepository.create({
      name,
      phone1,
      phone2,
      address,
      postalCode,
      city,
    });
  }

  async uploadLeadsFromFile(filePath: string): Promise<{
    totalLeads: number;
    campaignsCreated: number;
    leadsProcessed: number;
  }> {
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === ".csv") {
      return this.processCSVFile(filePath);
    } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
      return this.processExcelFile(filePath);
    } else {
      throw new Error(
        "Unsupported file format. Please upload CSV or Excel files."
      );
    }
  }

  private async processCSVFile(filePath: string): Promise<{
    totalLeads: number;
    campaignsCreated: number;
    leadsProcessed: number;
  }> {
    const leads: any[] = [];

    return new Promise((resolve, reject) => {
      const csv = require("csv-parser");

      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row: any) => {
          // Map CSV columns to lead data
          const leadData = {
            name: row.nom || row.name,
            address: row.adresse2 || row.address,
            postalCode: row.codepostal || row.postalCode,
            city: row.ville || row.city,
            phone1: row.tel1 || row.phone1,
            phone2: row.tel2 || row.phone2,
          };

          if (leadData.name && leadData.phone1) {
            leads.push(leadData);
          }
        })
        .on("end", async () => {
          try {
            const result = await this.processLeads(leads);
            resolve(result);
          } catch (error: any) {
            reject(error);
          }
        })
        .on("error", (error: any) => {
          reject(error);
        });
    });
  }

  private async processExcelFile(filePath: string): Promise<{
    totalLeads: number;
    campaignsCreated: number;
    leadsProcessed: number;
  }> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const leads: any[] = [];

      for (const row of jsonData) {
        const leadData = {
          name: (row as any).nom || (row as any).name,
          address: (row as any).adresse2 || (row as any).address,
          postalCode: (row as any).codepostal || (row as any).postalCode,
          city: (row as any).ville || (row as any).city,
          phone1: (row as any).tel1 || (row as any).phone1,
          phone2: (row as any).tel2 || (row as any).phone2,
        };

        if (leadData.name && leadData.phone1) {
          leads.push(leadData);
        }
      }

      return await this.processLeads(leads);
    } catch (error: any) {
      throw new Error(`Error processing Excel file: ${error.message}`);
    }
  }

  private async processLeads(leads: any[]): Promise<{
    totalLeads: number;
    campaignsCreated: number;
    leadsProcessed: number;
  }> {
    let leadsProcessed = 0;
    let campaignsCreated = 0;

    // Process leads in batches of 5
    for (let i = 0; i < leads.length; i += 5) {
      const batch = leads.slice(i, i + 5);

      // Create a new campaign for this batch
      const campaign = await this.campaignRepository.create({
        name: `Campaign ${Date.now()}-${campaignsCreated + 1}`,
      });
      campaignsCreated++;

      // Create leads and assign to campaign
      for (const leadData of batch) {
        const lead = await this.leadRepository.create({
          ...leadData,
          campaignId: campaign.id,
        });
        leadsProcessed++;
      }
    }

    return {
      totalLeads: leads.length,
      campaignsCreated,
      leadsProcessed,
    };
  }

  async updateLeadStatus(leadId: string, status: LeadStatus): Promise<any> {
    const lead = await this.leadRepository.findById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // If lead is being rescheduled, remove from current campaign
    if (status === LeadStatus.SCHEDULED && lead.campaignId) {
      await this.campaignRepository.removeLead(lead.campaignId, leadId);
    }

    return this.leadRepository.updateStatus(leadId, status);
  }

  async scheduleCall(
    customerPhoneNumber: string,
    scheduledCallAt: Date,
    note?: string
  ): Promise<any> {
    const lead = await this.leadRepository.findByPhone(customerPhoneNumber);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Remove from current campaign if exists
    if (lead.campaignId) {
      await this.campaignRepository.removeLead(
        lead.campaignId,
        customerPhoneNumber
      );
    }

    return this.leadRepository.updateScheduledCall(
      customerPhoneNumber,
      scheduledCallAt,
      note
    );
  }

  async blacklistLead(customerPhoneNumber: string): Promise<any> {
    const lead = await this.leadRepository.findByPhone(customerPhoneNumber);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Remove from current campaign if exists
    if (lead.campaignId) {
      await this.campaignRepository.removeLead(
        lead.campaignId,
        customerPhoneNumber
      );
    }

    return this.leadRepository.blacklist(customerPhoneNumber);
  }

  async getLeadsByStatus(status?: LeadStatus): Promise<any[]> {
    if (status) {
      return this.leadRepository.findByStatus(status);
    }
    return this.leadRepository.findAll();
  }

  async getScheduledCalls(): Promise<any[]> {
    return this.leadRepository.findScheduledCalls();
  }

  async getDueScheduledCalls(): Promise<any[]> {
    return this.leadRepository.findDueScheduledCalls();
  }

  async getAvailableLeadsForCampaign(): Promise<any[]> {
    return this.leadRepository.findAvailableForCampaign();
  }

  async getLeadById(leadId: string): Promise<any> {
    return this.leadRepository.findById(leadId);
  }

  async getLeadByPhone(phone: string): Promise<any> {
    return this.leadRepository.findByPhone(phone);
  }
}
