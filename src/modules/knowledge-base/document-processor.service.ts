import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as cheerio from 'cheerio';
import { DocumentType } from '../../schemas/knowledge-base.schema';

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  /**
   * Process PDF file and extract text
   */
  async processPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      const data = await pdfParse(buffer);

      return {
        text: data.text,
        pageCount: data.numpages,
      };
    } catch (error) {
      this.logger.error(`Error processing PDF: ${error.message}`, error.stack);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Process Word document (DOCX) and extract text
   */
  async processDocx(buffer: Buffer): Promise<{ text: string }> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      return {
        text: result.value,
      };
    } catch (error) {
      this.logger.error(`Error processing DOCX: ${error.message}`, error.stack);
      throw new Error(`Failed to process DOCX: ${error.message}`);
    }
  }

  /**
   * Process Excel file (XLSX, XLS) and extract text
   */
  async processExcel(buffer: Buffer): Promise<{ text: string; sheetCount: number }> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      let text = '';
      const sheetNames = workbook.SheetNames;

      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(sheet, { blankrows: false });
        text += `\n\n=== ${sheetName} ===\n\n${sheetText}`;
      }

      return {
        text: text.trim(),
        sheetCount: sheetNames.length,
      };
    } catch (error) {
      this.logger.error(`Error processing Excel: ${error.message}`, error.stack);
      throw new Error(`Failed to process Excel: ${error.message}`);
    }
  }

  /**
   * Fetch and parse web page content
   */
  async processUrl(url: string): Promise<{ text: string; title: string }> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script and style elements
      $('script, style, nav, footer, header').remove();

      // Extract title
      const title = $('title').text() || $('h1').first().text() || 'Untitled';

      // Extract main content
      let text = '';

      // Try to find main content area
      const mainContent = $('main, article, .content, #content, .main').first();

      if (mainContent.length > 0) {
        text = mainContent.text();
      } else {
        text = $('body').text();
      }

      // Clean up whitespace
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      return {
        text,
        title: title.trim(),
      };
    } catch (error) {
      this.logger.error(`Error processing URL ${url}: ${error.message}`, error.stack);
      throw new Error(`Failed to process URL: ${error.message}`);
    }
  }

  /**
   * Count words in text
   */
  countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Get document type from file extension or mime type
   */
  getDocumentType(filename: string, mimeType?: string): DocumentType {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (ext === 'pdf' || mimeType === 'application/pdf') {
      return DocumentType.PDF;
    }

    if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return DocumentType.DOCX;
    }

    if (
      ext === 'xlsx' ||
      ext === 'xls' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return DocumentType.XLSX;
    }

    throw new Error(`Unsupported file type: ${ext || mimeType}`);
  }

  /**
   * Process file based on type
   */
  async processFile(
    buffer: Buffer,
    filename: string,
    mimeType?: string,
  ): Promise<{
    text: string;
    type: DocumentType;
    metadata: {
      pageCount?: number;
      sheetCount?: number;
      wordCount: number;
    };
  }> {
    const type = this.getDocumentType(filename, mimeType);

    let text = '';
    let pageCount: number | undefined;
    let sheetCount: number | undefined;

    switch (type) {
      case DocumentType.PDF:
        const pdfResult = await this.processPdf(buffer);
        text = pdfResult.text;
        pageCount = pdfResult.pageCount;
        break;

      case DocumentType.DOCX:
        const docxResult = await this.processDocx(buffer);
        text = docxResult.text;
        break;

      case DocumentType.XLSX:
        const excelResult = await this.processExcel(buffer);
        text = excelResult.text;
        sheetCount = excelResult.sheetCount;
        break;

      default:
        throw new Error(`Unsupported document type: ${type}`);
    }

    const wordCount = this.countWords(text);

    return {
      text,
      type,
      metadata: {
        pageCount,
        sheetCount,
        wordCount,
      },
    };
  }
}
