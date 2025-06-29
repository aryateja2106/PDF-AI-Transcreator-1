import { NextRequest, NextResponse } from 'next/server';
import { PdfReader } from 'pdfreader';
import { documentQueries } from '@/lib/database';
import tesseract from 'node-tesseract-ocr';
import pdf2pic from 'pdf2pic';
import fs from 'fs';
import path from 'path';

// OCR fallback function for image-based PDFs
async function extractTextWithOCR(buffer: Buffer, filename: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp');
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempPdfPath = path.join(tempDir, `${Date.now()}-${filename}`);
  let extractedText = '';
  
  try {
    // Write PDF buffer to temporary file
    fs.writeFileSync(tempPdfPath, buffer);
    
    // Convert PDF to images (first 3 pages only)
    const convert = pdf2pic.fromPath(tempPdfPath, {
      density: 200, // Higher density for better OCR
      saveFilename: "page",
      savePath: tempDir,
      format: "png",
      width: 1200,
      height: 1600
    });
    
    // Convert only first 3 pages to save processing time
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      try {
        console.log(`Converting PDF page ${pageNum} to image for OCR...`);
        const result = await convert(pageNum, { responseType: "image" });
        
        if (result.path) {
          console.log(`Running OCR on page ${pageNum}...`);
          const pageText = await tesseract.recognize(result.path, {
            lang: 'eng',
            oem: 1,
            psm: 3
          });
          
          if (pageText && pageText.trim()) {
            extractedText += pageText.trim() + '\n\n';
          }
          
          // Clean up image file
          if (fs.existsSync(result.path)) {
            fs.unlinkSync(result.path);
          }
        }
      } catch (pageError) {
        console.warn(`OCR failed for page ${pageNum}:`, pageError);
        // Continue with next page
      }
    }
    
    return extractedText.trim();
    
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('Failed to extract text using OCR');
  } finally {
    // Clean up temporary PDF file
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }
  }
}

// Text cleaning and preprocessing function
function cleanAndProcessText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple newlines
    .replace(/\n+/g, '\n')
    // Remove special characters that might confuse TTS
    .replace(/[^\w\s\.\,\!\?\-\(\)\[\]\:\"\']/g, ' ')
    // Fix spacing around punctuation
    .replace(/\s+([\.!\?])/g, '$1')
    .replace(/([\.!\?])\s*/g, '$1 ')
    // Remove leading/trailing whitespace
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== PDF extraction started ===');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('File received:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    if (file.size < 100) { // Too small to be a valid PDF
      return NextResponse.json(
        { error: 'File appears to be corrupted or empty' },
        { status: 400 }
      );
    }

    // Check if we already have this file processed (cache check)
    const existingDoc = documentQueries.findByFilename.get(file.name) as {
      id: number;
      extracted_text: string;
      page_count: number;
      extracted_pages: number;
      file_size: number;
      original_filename: string;
    } | undefined;
    if (existingDoc && existingDoc.file_size === file.size) {
      console.log('Found cached document:', existingDoc.id);
      return NextResponse.json({
        text: existingDoc.extracted_text,
        pages: existingDoc.page_count,
        extractedPages: existingDoc.extracted_pages,
        extractedLength: existingDoc.extracted_text.length,
        originalLength: existingDoc.extracted_text.length,
        filename: existingDoc.original_filename,
        documentId: existingDoc.id,
        cached: true
      });
    }

    // Convert file to buffer
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('File buffer is empty');
    }

    // Check PDF header
    const pdfHeader = buffer.slice(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      throw new Error('Invalid PDF file - missing PDF header');
    }

    console.log('PDF header validated successfully');

    // Extract text using pdfreader (reliable and stable)
    console.log('Starting text extraction with pdfreader...');
    
    let totalPages = 0;
    let extractedText = await new Promise<string>((resolve, reject) => {
      let text = '';
      let pageCount = 0;
      let currentPage = 0;
      const maxPages = 3; // Extract first 3 pages as per prototype spec

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
        if (err) {
          console.error('PdfReader error:', err);
          reject(new Error(`PDF parsing failed: ${err.message}`));
          return;
        }

        if (!item) {
          // End of file
          totalPages = pageCount;
          console.log('PDF parsing completed:', {
            pages: pageCount,
            textLength: text.length
          });
          resolve(text.trim());
          return;
        }

        if (item.page) {
          // New page
          currentPage = item.page;
          pageCount = Math.max(pageCount, currentPage);
          console.log(`Processing page ${currentPage}`);
          
          // Stop after maxPages
          if (currentPage > maxPages) {
            totalPages = pageCount;
            console.log(`Stopping extraction after ${maxPages} pages`);
            resolve(text.trim());
            return;
          }
        }

        if (item.text && currentPage <= maxPages) {
          // Text item - add to extracted text
          text += item.text + ' ';
        }
      });
    });

    console.log(`Initial text extraction successful. Length: ${extractedText.length}`);

    // If text extraction failed, try OCR as fallback
    if (extractedText.trim().length < 50) { // Arbitrary threshold to detect empty/failed extraction
      console.warn('Regular text extraction yielded very little text. Attempting OCR fallback...');
      extractedText = await extractTextWithOCR(buffer, file.name);
      
      if (extractedText.trim().length === 0) {
        console.error('OCR fallback also failed to extract text.');
        return NextResponse.json(
          { error: "Could not extract text from PDF. The document may be empty, corrupted, or an unsupported format." },
          { status: 400 }
        );
      }
      console.log(`OCR extraction successful. Length: ${extractedText.length}`);
    }

    // Clean and process the extracted text
    const cleanedText = cleanAndProcessText(extractedText);
    const originalLength = cleanedText.length;
    let finalText = cleanedText;
    let wasTruncated = false;

    // Limit text to a safe number of characters (~500-600 tokens)
    const MAX_CHARS = 2200; 
    if (finalText.length > MAX_CHARS) {
      const truncated = finalText.substring(0, MAX_CHARS);
      // Try to cut at the last full stop
      const lastPeriod = truncated.lastIndexOf('.');
      if (lastPeriod > 0) {
        finalText = truncated.substring(0, lastPeriod + 1);
      } else {
        // Fallback if no period is found
        finalText = truncated;
      }
      wasTruncated = true;
      console.log(`Text truncated for safety from ${originalLength} to ${finalText.length} characters.`);
    }

    // Store the processed document in the database
    console.log('Storing document in database...');
    const insertResult = documentQueries.insert.run(
      file.name,
      file.name,
      file.size,
      finalText, // Store the (potentially truncated) text
      totalPages,
      totalPages > 3 ? 3 : totalPages
    );
    const documentId = insertResult.lastInsertRowid;
    console.log('Document stored with ID:', documentId);
    
    // Return the response
    return NextResponse.json({
      text: finalText,
      pages: totalPages,
      extractedPages: totalPages > 3 ? 3 : totalPages,
      originalLength: originalLength,
      extractedLength: finalText.length,
      wasTruncated: wasTruncated,
      filename: file.name,
      documentId: documentId,
      cached: false,
    });
  } catch (error) {
    console.error('Unhandled error in PDF extraction:', error);
    console.error('=== PDF extraction failed ===');
    console.error('Error details:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      
      // Provide specific error messages
      if (error.message.includes('PDF header')) {
        return NextResponse.json(
          { error: 'Invalid PDF file format. Please ensure you uploaded a valid PDF.' },
          { status: 400 }
        );
      }
      if (error.message.includes('Password') || error.message.includes('password')) {
        return NextResponse.json(
          { error: 'Password-protected PDFs are not supported' },
          { status: 400 }
        );
      }
      if (error.message.includes('meaningful text') || error.message.includes('image-based')) {
        return NextResponse.json(
          { error: 'Could not extract text from PDF. The PDF might be image-based or contain mostly graphics.' },
          { status: 400 }
        );
      }
      if (error.message.includes('empty') || error.message.includes('corrupted')) {
        return NextResponse.json(
          { error: 'PDF file appears to be corrupted or empty' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process PDF. Please ensure the PDF contains selectable text and try again.' },
      { status: 500 }
    );
  }
} 