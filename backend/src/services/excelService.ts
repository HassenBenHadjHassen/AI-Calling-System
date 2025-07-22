import * as XLSX from 'xlsx';
import fs from 'fs';

interface LeadData {
  phone: string;
  name?: string;
  email?: string;
}

export class ExcelService {
  static async parseExcelFile(filePath: string): Promise<LeadData[]> {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (rawData.length === 0) {
        throw new Error('Excel file is empty');
      }
      
      // Assume first row contains headers
      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1) as any[][];
      
      // Find column indices for phone, name, email
      const phoneIndex = this.findColumnIndex(headers, ['phone', 'telephone', 'tel', 'number']);
      const nameIndex = this.findColumnIndex(headers, ['name', 'nom', 'prenom', 'firstname', 'lastname']);
      const emailIndex = this.findColumnIndex(headers, ['email', 'mail', 'e-mail']);
      
      if (phoneIndex === -1) {
        throw new Error('Phone number column not found. Expected columns: phone, telephone, tel, or number');
      }
      
      const leads: LeadData[] = [];
      
      for (const row of dataRows) {
        if (row.length === 0 || !row[phoneIndex]) continue;
        
        const phone = this.normalizePhoneNumber(String(row[phoneIndex]));
        if (!phone) continue;
        
        const lead: LeadData = {
          phone,
          name: nameIndex !== -1 ? String(row[nameIndex] || '').trim() : undefined,
          email: emailIndex !== -1 ? String(row[emailIndex] || '').trim() : undefined,
        };
        
        // Remove empty string values
        if (lead.name === '') lead.name = undefined;
        if (lead.email === '') lead.email = undefined;
        
        leads.push(lead);
      }
      
      // Clean up the uploaded file
      fs.unlinkSync(filePath);
      
      return leads;
    } catch (error) {
      // Clean up the uploaded file even if parsing fails
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  }
  
  static parseCSVFile(filePath: string): Promise<LeadData[]> {
    try {
      // Read CSV file
      const workbook = XLSX.readFile(filePath, { type: 'file' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON (same logic as Excel)
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (rawData.length === 0) {
        throw new Error('CSV file is empty');
      }
      
      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1) as any[][];
      
      const phoneIndex = this.findColumnIndex(headers, ['phone', 'telephone', 'tel', 'number']);
      const nameIndex = this.findColumnIndex(headers, ['name', 'nom', 'prenom', 'firstname', 'lastname']);
      const emailIndex = this.findColumnIndex(headers, ['email', 'mail', 'e-mail']);
      
      if (phoneIndex === -1) {
        throw new Error('Phone number column not found');
      }
      
      const leads: LeadData[] = [];
      
      for (const row of dataRows) {
        if (row.length === 0 || !row[phoneIndex]) continue;
        
        const phone = this.normalizePhoneNumber(String(row[phoneIndex]));
        if (!phone) continue;
        
        const lead: LeadData = {
          phone,
          name: nameIndex !== -1 ? String(row[nameIndex] || '').trim() : undefined,
          email: emailIndex !== -1 ? String(row[emailIndex] || '').trim() : undefined,
        };
        
        if (lead.name === '') lead.name = undefined;
        if (lead.email === '') lead.email = undefined;
        
        leads.push(lead);
      }
      
      // Clean up the uploaded file
      fs.unlinkSync(filePath);
      
      return Promise.resolve(leads);
    } catch (error) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  }
  
  private static findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase().trim();
      if (possibleNames.some(name => header.includes(name))) {
        return i;
      }
    }
    return -1;
  }
  
  private static normalizePhoneNumber(phone: string): string | null {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with 0, replace with +33 (French number)
    if (cleaned.startsWith('0')) {
      cleaned = '+33' + cleaned.substring(1);
    }
    
    // If it doesn't start with +, assume it's a French number
    if (!cleaned.startsWith('+')) {
      cleaned = '+33' + cleaned;
    }
    
    // Validate French phone number format
    if (cleaned.match(/^\+33[1-9][0-9]{8}$/)) {
      return cleaned;
    }
    
    // Allow other international formats but warn
    if (cleaned.match(/^\+[1-9][0-9]{7,14}$/)) {
      return cleaned;
    }
    
    return null; // Invalid phone number
  }
}
