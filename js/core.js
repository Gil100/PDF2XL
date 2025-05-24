// PDF Converter Core - Simplified Version
class PDFConverterCore {
    constructor() {
        this.files = [];
        this.processedData = [];
        this.isProcessing = false;
        this.tesseractWorker = null;
        
        this.bindEvents();
        
        this.exporters = {
            xlsx: new ExcelExporter(),
            csv: new CSVExporter(), 
            docx: new DOCXExporter()
        };
        
        this.log('PDF Converter Core initialized successfully');
    }

    bindEvents() {
        const fileInput = document.getElementById('fileInput');
        const dropZone = document.getElementById('dropZone');
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files, false);
            });
        }
        
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            dropZone.addEventListener('drop', (e) => this.handleDrop(e, false));
        }

        const batchFileInput = document.getElementById('batchFileInput');
        const batchDropZone = document.getElementById('batchDropZone');
        
        if (batchFileInput) {
            batchFileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files, true);
            });
        }
        
        if (batchDropZone) {
            batchDropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            batchDropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            batchDropZone.addEventListener('drop', (e) => this.handleDrop(e, true));
        }

        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processFiles());
        }

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadFile());
        }

        const newFileBtn = document.getElementById('newFileBtn');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', () => this.resetToNewFile());
        }

        const newFileBtn2 = document.getElementById('newFileBtn2');
        if (newFileBtn2) {
            newFileBtn2.addEventListener('click', () => this.resetToNewFile());
        }

        const outputFormat = document.getElementById('outputFormat');
        if (outputFormat) {
            outputFormat.addEventListener('change', (e) => {
                this.updateFormatOptions(e.target.value);
            });
        }
    }

    updateFormatOptions(format) {
        const sections = ['xlsxOptions', 'csvOptions', 'docxOptions'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'none';
            }
        });

        const selectedSection = document.getElementById(`${format}Options`);
        if (selectedSection) {
            selectedSection.style.display = 'block';
        }
    }

    async handleFileSelect(files, isBatch) {
        if (!files || files.length === 0) {
            this.showError('לא נבחרו קבצים');
            return;
        }

        const pdfFiles = Array.from(files).filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );

        if (pdfFiles.length === 0) {
            this.showError('אנא בחר קבצי PDF בלבד');
            return;
        }

        if (!isBatch && this.files.length > 0) {
            this.resetToNewFile();
        }

        this.files.push(...pdfFiles);
        this.updateFileList();
        this.showProcessButton();
        this.hideError();
    }

    updateFileList() {
        const fileListContainer = document.getElementById('fileList');
        if (!fileListContainer) return;

        fileListContainer.innerHTML = '';
        if (this.files.length === 0) return;

        const listHtml = this.files.map((file, index) => `
            <div class="file-item border rounded p-2 mb-2 d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-file-pdf text-danger me-2"></i>
                    <span class="file-name">${file.name}</span>
                    <small class="text-muted ms-2">(${this.formatFileSize(file.size)})</small>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="window.pdfConverter.removeFile(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        fileListContainer.innerHTML = `<h5>קבצים נבחרים (${this.files.length})</h5>${listHtml}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileList();
        if (this.files.length === 0) {
            this.hideProcessButton();
        }
    }

    showProcessButton() {
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.style.display = 'inline-block';
        }
    }

    hideProcessButton() {
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.style.display = 'none';
        }
    }

    async processFiles() {
        if (this.files.length === 0) {
            this.showError('אנא בחר קבצים לעיבוד');
            return;
        }

        if (this.isProcessing) {
            this.log('Already processing files', 'warn');
            return;
        }

        this.isProcessing = true;
        this.processedData = [];

        try {
            this.showProgress();
            this.hideError();

            const language = document.getElementById('ocrLanguage')?.value || 'heb+eng';

            for (let i = 0; i < this.files.length; i++) {
                const file = this.files[i];
                this.updateProgress((i / this.files.length) * 100, `עיבוד קובץ ${i + 1} מתוך ${this.files.length}`);
                this.updateCurrentFile(file.name);

                try {
                    const result = await this.processFile(file, language);
                    this.processedData.push({
                        fileName: file.name,
                        data: result,
                        success: true
                    });
                } catch (error) {
                    this.log(`Error processing file ${file.name}: ${error.message}`, 'error');
                    this.processedData.push({
                        fileName: file.name,
                        error: error.message,
                        success: false
                    });
                }
            }

            this.updateProgress(100, 'העיבוד הושלם בהצלחה!');
            await this.displayResults();

        } catch (error) {
            this.showError(`שגיאה בעיבוד: ${error.message}`);
            this.log(`Processing error: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.hideProgress();
        }
    }

    async processFile(file, language) {
        this.log(`Processing: ${file.name}`);
        
        try {
            // Load PDF using PDF.js
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            const totalPages = pdf.numPages;
            let allData = [];
            
            // Process each page
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                this.updateProgress(
                    ((pageNum - 1) / totalPages) * 100,
                    `מעבד עמוד ${pageNum} מתוך ${totalPages} - ${file.name}`
                );

                const page = await pdf.getPage(pageNum);
                const pageData = await this.processPage(page, language);
                
                if (pageData && pageData.length > 0) {
                    allData = allData.concat(pageData);
                }
            }

            this.log(`Extracted ${allData.length} rows from ${file.name}`);
            return allData;
            
        } catch (error) {
            this.log(`Error processing ${file.name}: ${error.message}`, 'error');
            throw error;
        }
    }

    async processPage(page, language) {
        try {
            this.log('Processing page...', 'debug');
            
            // First try to extract text directly
            const textContent = await page.getTextContent();
            
            if (textContent.items.length > 0) {
                this.log('Found ' + textContent.items.length + ' text items, extracting table...', 'debug');
                const tableData = this.extractTableFromText(textContent);
                
                // If we got reasonable table data, return it
                if (tableData && tableData.length > 0 && 
                    tableData.some(row => row.some(cell => cell.trim().length > 0))) {
                    this.log('Successfully extracted ' + tableData.length + ' rows from text', 'success');
                    return tableData;
                } else {
                    this.log('Text extraction returned empty or invalid data', 'warn');
                }
            }
            
            this.log('Text extraction failed or no data, falling back to OCR...', 'warn');
            // Fallback to OCR if no text content or extraction failed
            return await this.extractTableFromOCR(page, language);
            
        } catch (error) {
            this.log('Error processing page: ' + error.message, 'error');
            // Try OCR as fallback
            this.log('Falling back to OCR due to error...', 'warn');
            return await this.extractTableFromOCR(page, language);
        }
    }

    extractTableFromText(textContent) {
        const items = textContent.items;
        if (!items || items.length === 0) return [];
        
        this.log('Processing ' + items.length + ' text items');
        
        // Filter out empty or very short text items
        const validItems = items.filter(item => 
            item.str && item.str.trim().length > 0
        );
        
        if (validItems.length === 0) {
            this.log('No valid text items found');
            return [];
        }
        
        // Group text items by Y coordinate with tolerance (rows)
        const yTolerance = 8; // pixels tolerance for same row
        const rowGroups = [];
        
        validItems.forEach(item => {
            const y = Math.round(item.transform[5]);
            const x = Math.round(item.transform[4]);
            
            // Find existing row group within tolerance
            let foundGroup = rowGroups.find(group => 
                Math.abs(group.y - y) <= yTolerance
            );
            
            if (!foundGroup) {
                foundGroup = { y: y, items: [] };
                rowGroups.push(foundGroup);
            }
            
            foundGroup.items.push({
                text: item.str.trim(),
                x: x,
                y: y,
                width: item.width || 0,
                height: item.height || 0
            });
        });

        // Sort rows by Y coordinate (top to bottom)
        rowGroups.sort((a, b) => b.y - a.y);
        
        this.log('Found ' + rowGroups.length + ' row groups');
        
        // Process each row to detect columns
        const tableData = [];
        
        rowGroups.forEach((rowGroup, rowIndex) => {
            // Sort items in row by X coordinate (left to right for LTR)
            const sortedItems = rowGroup.items.sort((a, b) => a.x - b.x);
            
            // Process row items to detect columns
            const row = this.processRowItems(sortedItems);
            
            if (row && row.length > 0) {
                tableData.push(row);
                this.log('Row ' + (rowIndex + 1) + ': ' + JSON.stringify(row));
            }
        });

        this.log('Extracted ' + tableData.length + ' rows from text');
        return this.normalizeTable(tableData);
    }
    
    // Process items in a single row to detect columns
    processRowItems(items) {
        if (items.length === 0) return [];
        
        if (items.length === 1) {
            return [items[0].text];
        }
        
        // Calculate gaps between text items to detect column boundaries
        const gaps = [];
        for (let i = 0; i < items.length - 1; i++) {
            const currentItem = items[i];
            const nextItem = items[i + 1];
            const gap = nextItem.x - (currentItem.x + currentItem.width);
            gaps.push(gap);
        }
        
        // Determine significant gaps (potential column separators)
        const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
        const significantGapThreshold = Math.max(avgGap * 1.5, 30); // At least 30 pixels or 1.5x average
        
        // Group items into columns based on significant gaps
        const columns = [];
        let currentColumn = [items[0]];
        
        for (let i = 0; i < gaps.length; i++) {
            if (gaps[i] > significantGapThreshold) {
                // Significant gap - start new column
                columns.push(currentColumn);
                currentColumn = [items[i + 1]];
            } else {
                // Same column - add to current
                currentColumn.push(items[i + 1]);
            }
        }
        
        // Add the last column
        if (currentColumn.length > 0) {
            columns.push(currentColumn);
        }
        
        // Convert columns to text
        return columns.map(column => {
            return column.map(item => item.text).join(' ').trim();
        });
    }

    async extractTableFromOCR(page, language) {
        try {
            // Initialize Tesseract worker if not already done
            if (!this.tesseractWorker) {
                this.log('Initializing Tesseract worker for Hebrew financial documents...', 'debug');
                this.tesseractWorker = await Tesseract.createWorker();
                await this.tesseractWorker.loadLanguage(language || 'heb+eng');
                await this.tesseractWorker.initialize(language || 'heb+eng');
                
                // Configure Tesseract for Hebrew financial documents
                await this.configureTesseractForHebrew();
            }

            // Render page to canvas with enhanced resolution for Hebrew text
            const viewport = page.getViewport({ scale: 3.0 }); // Higher scale for Hebrew
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Pre-process image for better Hebrew OCR
            const processedCanvas = await this.preprocessImageForHebrew(canvas);

            this.log('Performing OCR on Hebrew financial document...', 'debug');
            
            // Perform OCR with Hebrew-optimized settings
            const { data: { text } } = await this.tesseractWorker.recognize(processedCanvas, {
                tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
                tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine only
                preserve_interword_spaces: '1',
                tessedit_char_whitelist: '', // Allow all characters
                // Hebrew-specific optimizations
                textord_heavy_nr: '1',
                textord_debug_tabfind: '0',
                classify_enable_learning: '0',
                classify_enable_adaptive_matcher: '1',
                classify_use_pre_adapted_templates: '1',
                segment_penalty_dict_nonword: '1.25',
                segment_penalty_garbage: '1.50',
                language_model_ngram_on: '1',
                stopper_smallword_size: '2',
                wordrec_enable_assoc: '1',
                // Financial document optimizations
                tessedit_enable_dict_correction: '1',
                load_system_dawg: '1',
                load_freq_dawg: '1',
                load_unambig_dawg: '1',
                load_punc_dawg: '1',
                load_number_dawg: '1',
                load_bigram_dawg: '1'
            });

            return this.parseHebrewFinancialOCR(text);
            
        } catch (error) {
            this.log(`Hebrew OCR failed: ${error.message}`, 'error');
            return [];
        }
    }

    // Configure Tesseract specifically for Hebrew financial documents
    async configureTesseractForHebrew() {
        try {
            this.log('Configuring Tesseract for Hebrew financial documents...', 'debug');
            
            // Set Hebrew-specific parameters
            await this.tesseractWorker.setParameters({
                tessedit_pageseg_mode: '1', // Auto page segmentation with OSD
                tessedit_ocr_engine_mode: '1', // LSTM only
                preserve_interword_spaces: '1',
                // Hebrew text optimization
                textord_heavy_nr: '1',
                textord_tabfind_show_vlines: '0',
                textord_use_cjk_fp_model: '0',
                // Better character recognition
                classify_enable_learning: '0',
                classify_enable_adaptive_matcher: '1',
                classify_use_pre_adapted_templates: '1',
                // Financial document specific
                tessedit_enable_dict_correction: '1',
                load_system_dawg: '1',
                load_freq_dawg: '1',
                load_number_dawg: '1',
                // Hebrew RTL support
                bidi_debug: '0',
                textord_debug_tabfind: '0'
            });
            
            this.log('Tesseract configured for Hebrew financial documents', 'success');
        } catch (error) {
            this.log('Failed to configure Tesseract: ' + error.message, 'warn');
        }
    }

    // Pre-process image for better Hebrew OCR
    async preprocessImageForHebrew(canvas) {
        try {
            this.log('Pre-processing image for Hebrew OCR...', 'debug');
            
            const processedCanvas = document.createElement('canvas');
            const ctx = processedCanvas.getContext('2d');
            
            processedCanvas.width = canvas.width;
            processedCanvas.height = canvas.height;
            
            // Get image data
            const originalCtx = canvas.getContext('2d');
            const imageData = originalCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Apply image processing optimizations for Hebrew text
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Convert to grayscale with optimized weights for Hebrew
                const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                
                // Enhanced contrast for Hebrew characters
                const enhanced = gray < 128 ? 
                    Math.max(0, gray - 30) : 
                    Math.min(255, gray + 30);
                
                // Apply sharpening for Hebrew text
                const sharp = enhanced > 127 ? 255 : 0;
                
                data[i] = sharp;     // R
                data[i + 1] = sharp; // G
                data[i + 2] = sharp; // B
                // Alpha stays the same
            }
            
            // Put processed data back
            ctx.putImageData(imageData, 0, 0);
            
            this.log('Image pre-processing completed', 'debug');
            return processedCanvas;
            
        } catch (error) {
            this.log('Image pre-processing failed: ' + error.message, 'warn');
            return canvas; // Return original if processing fails
        }
    }

    // Parse OCR text specifically for Hebrew financial documents
    parseHebrewFinancialOCR(text) {
        if (!text || !text.trim()) return [];
        
        this.log('Parsing Hebrew financial OCR text: ' + text.substring(0, 100) + '...');
        
        const lines = text.split('\n').filter(line => line.trim());
        const tableData = [];

        lines.forEach((line, lineIndex) => {
            this.log('Processing Hebrew line ' + (lineIndex + 1) + ': ' + line);
            
            // Clean common Hebrew OCR errors first
            let cleanLine = this.cleanHebrewOCRErrors(line);
            
            // Try Hebrew-specific column detection methods
            let cells = [];
            
            // Method 1: Hebrew financial pattern - numbers with Hebrew descriptions
            const hebrewFinancialPattern = /([\d,\.]+)\s+([\u0590-\u05FF\s]+)/g;
            let matches = [];
            let match;
            
            while ((match = hebrewFinancialPattern.exec(cleanLine)) !== null) {
                matches.push(match[2].trim(), match[1].trim()); // Hebrew first, then number
            }
            
            if (matches.length > 0) {
                cells = matches;
                this.log('Method 1 (Hebrew financial pattern): ' + cells.length + ' cells');
            }
            
            // Method 2: Split by significant spaces (Hebrew text often has different spacing)
            if (cells.length <= 1) {
                cells = cleanLine.split(/\s{4,}/).filter(cell => cell.trim());
                this.log('Method 2 (Hebrew spaces): ' + cells.length + ' cells');
            }
            
            // Method 3: Try tabs and common separators
            if (cells.length <= 1) {
                const separators = ['\t', '|', ':', ';'];
                for (const separator of separators) {
                    if (cleanLine.includes(separator)) {
                        const testCells = cleanLine.split(separator).filter(cell => cell.trim());
                        if (testCells.length > cells.length) {
                            cells = testCells;
                            this.log('Method 3 (' + separator + '): ' + cells.length + ' cells');
                            break;
                        }
                    }
                }
            }
            
            // Method 4: Hebrew number-text alternating pattern
            if (cells.length <= 1 && /[\u0590-\u05FF]/.test(cleanLine)) {
                const alternatingPattern = /(?:([\u0590-\u05FF\s]+?)\s*([0-9,\.\-\(\)]+)|([0-9,\.\-\(\)]+)\s*([\u0590-\u05FF\s]+?))/g;
                const altMatches = [];
                
                while ((match = alternatingPattern.exec(cleanLine)) !== null) {
                    if (match[1] && match[2]) {
                        altMatches.push(match[1].trim(), match[2].trim());
                    } else if (match[3] && match[4]) {
                        altMatches.push(match[4].trim(), match[3].trim());
                    }
                }
                
                if (altMatches.length > 0) {
                    cells = altMatches;
                    this.log('Method 4 (Hebrew alternating): ' + cells.length + ' cells');
                }
            }
            
            // Method 5: Smart Hebrew word boundary detection
            if (cells.length <= 1 && cleanLine.length > 10) {
                cells = this.smartSplitHebrewLine(cleanLine);
                this.log('Method 5 (Hebrew smart split): ' + cells.length + ' cells');
            }
            
            // Last resort: treat as single cell but clean it
            if (cells.length === 0 && cleanLine.trim()) {
                cells = [cleanLine.trim()];
                this.log('Method 6 (single Hebrew cell): 1 cell');
            }
            
            // Clean and validate cells
            if (cells.length > 0) {
                const cleanCells = cells.map(cell => this.cleanHebrewCell(cell))
                                      .filter(cell => cell.length > 0);
                if (cleanCells.length > 0) {
                    tableData.push(cleanCells);
                    this.log('Added Hebrew row ' + (lineIndex + 1) + ': ' + JSON.stringify(cleanCells));
                }
            }
        });

        this.log('Hebrew OCR extracted ' + tableData.length + ' rows');
        return this.normalizeHebrewTable(tableData);
    }
    
    // Clean common Hebrew OCR errors
    cleanHebrewOCRErrors(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // Fix common Hebrew OCR character confusions
        const hebrewFixes = [
            // Common OCR errors in Hebrew
            [/[״"]/g, '"'],           // Normalize quotes
            [/[׳']/g, "'"],           // Normalize apostrophes  
            [/ח/g, 'ח'],              // Chet normalization
            [/כ/g, 'כ'],              // Kaf normalization
            [/ם/g, 'ם'],              // Final Mem
            [/ן/g, 'ן'],              // Final Nun
            [/ף/g, 'ף'],              // Final Pe
            [/ץ/g, 'ץ'],              // Final Tzadi
            [/ך/g, 'ך'],              // Final Kaf
            // Number and punctuation fixes
            [/[Oo]/g, '0'],           // O to zero
            [/[Il|]/g, '1'],          // I/l to one
            [/\s+/g, ' '],            // Multiple spaces to single
            [/[\u200E\u200F\u202A-\u202E]/g, ''], // Remove RTL markers
        ];
        
        hebrewFixes.forEach(([pattern, replacement]) => {
            cleaned = cleaned.replace(pattern, replacement);
        });
        
        return cleaned.trim();
    }

    // Smart split for Hebrew lines
    smartSplitHebrewLine(line) {
        // Hebrew-specific patterns for financial documents
        const patterns = [
            // Hebrew description followed by numbers
            /([\u0590-\u05FF\s]+?)\s+([0-9,\.\-\(\)]+)/g,
            // Numbers followed by Hebrew description  
            /([0-9,\.\-\(\)]+)\s+([\u0590-\u05FF\s]+)/g,
            // Significant spacing (3+ spaces in Hebrew)
            /(.+?)\s{3,}(.+)/g
        ];
        
        for (const pattern of patterns) {
            const matches = [];
            let match;
            let lastIndex = 0;
            
            while ((match = pattern.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    const prefix = line.substring(lastIndex, match.index).trim();
                    if (prefix) matches.push(prefix);
                }
                matches.push(match[1].trim(), match[2].trim());
                lastIndex = pattern.lastIndex;
            }
            
            if (lastIndex < line.length) {
                const suffix = line.substring(lastIndex).trim();
                if (suffix) matches.push(suffix);
            }
            
            const validMatches = matches.filter(m => m.length > 0);
            if (validMatches.length > 1) {
                return validMatches;
            }
        }
        
        return [line.trim()];
    }

    // Clean individual Hebrew cells
    cleanHebrewCell(cell) {
        if (!cell) return '';
        
        let cleaned = cell.toString().trim();
        
        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // Clean Hebrew-specific artifacts
        cleaned = cleaned.replace(/^[^\u0590-\u05FF0-9]+/, ''); // Remove leading non-Hebrew/non-numeric
        cleaned = cleaned.replace(/[^\u0590-\u05FF0-9\s\.\,\-\(\)]+$/, ''); // Remove trailing artifacts
        
        // Fix common number formatting
        if (/^[\d,\.\-\(\)]+$/.test(cleaned)) {
            cleaned = cleaned.replace(/,(?=\d{3})/g, ','); // Ensure proper comma placement
        }
        
        return cleaned.trim();
    }

    // Normalize table specifically for Hebrew content
    normalizeHebrewTable(tableData) {
        if (!tableData || tableData.length === 0) return [];

        this.log('Normalizing Hebrew table with ' + tableData.length + ' rows');
        
        // Remove completely empty rows
        const nonEmptyRows = tableData.filter(row => 
            row.some(cell => cell && cell.trim().length > 0)
        );
        
        if (nonEmptyRows.length === 0) return [];
        
        // Find maximum column count
        const maxColumns = Math.max(...nonEmptyRows.map(row => row.length));
        this.log('Maximum columns detected: ' + maxColumns);
        
        // Clean and normalize each row with Hebrew-specific processing
        const normalizedTable = nonEmptyRows.map((row, rowIndex) => {
            // Pad row to have consistent column count
            const paddedRow = [...row];
            while (paddedRow.length < maxColumns) {
                paddedRow.push('');
            }
            
            // Clean cell data with Hebrew optimizations
            return paddedRow.map(cell => {
                if (!cell) return '';
                
                let cleanCell = this.cleanHebrewCell(cell);
                
                // Additional Hebrew-specific cleaning
                cleanCell = cleanCell.replace(/[״"]/g, '"');
                cleanCell = cleanCell.replace(/[׳']/g, "'");
                
                // Ensure proper RTL text direction markers are removed
                cleanCell = cleanCell.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
                
                return cleanCell;
            });
        });
        
        // Try to detect and merge Hebrew header rows 
        const mergedTable = this.mergeHebrewHeaderRows(normalizedTable);
        
        // Filter out rows that are likely to be artifacts
        const filteredTable = mergedTable.filter((row, index) => {
            const nonEmptyCells = row.filter(cell => cell.trim().length > 0);
            const hasHebrewContent = row.some(cell => /[\u0590-\u05FF]/.test(cell));
            const hasNumbers = row.some(cell => /\d/.test(cell));
            
            // Keep rows with Hebrew content or numbers, minimum 1 cell for Hebrew docs
            if (nonEmptyCells.length < 1) {
                this.log('Filtering out empty Hebrew row ' + (index + 1));
                return false;
            }
            
            // Keep if has meaningful content (Hebrew text or numbers)
            if (!hasHebrewContent && !hasNumbers && nonEmptyCells.length < 2) {
                this.log('Filtering out non-meaningful row ' + (index + 1) + ': ' + JSON.stringify(row));
                return false;
            }
            
            return true;
        });
        
        this.log('Normalized Hebrew table: ' + filteredTable.length + ' rows');
        return filteredTable;
    }

    // Merge Hebrew header rows that might be split
    mergeHebrewHeaderRows(tableData) {
        if (tableData.length < 2) return tableData;
        
        const result = [...tableData];
        
        // Check if first few rows might be split Hebrew headers
        for (let i = 0; i < Math.min(3, result.length - 1); i++) {
            const currentRow = result[i];
            const nextRow = result[i + 1];
            
            // Check if rows should be merged (Hebrew headers often split)
            if (this.shouldMergeHebrewRows(currentRow, nextRow)) {
                this.log('Merging Hebrew rows ' + (i + 1) + ' and ' + (i + 2));
                
                // Merge the rows with Hebrew-aware logic
                const mergedRow = currentRow.map((cell, colIndex) => {
                    const currentCell = cell || '';
                    const nextCell = nextRow[colIndex] || '';
                    
                    if (!currentCell && nextCell) return nextCell;
                    if (currentCell && !nextCell) return currentCell;
                    if (!currentCell && !nextCell) return '';
                    
                    // Both have content - combine with proper Hebrew spacing
                    const combined = (currentCell + ' ' + nextCell).trim();
                    return this.cleanHebrewCell(combined);
                });
                
                result[i] = mergedRow;
                result.splice(i + 1, 1); // Remove the merged row
                i--; // Recheck from same position
            }
        }
        
        return result;
    }
    
    // Determine if two Hebrew rows should be merged
    shouldMergeHebrewRows(row1, row2) {
        if (!row1 || !row2) return false;
        
        let emptyInFirst = 0;
        let emptyInSecond = 0;
        let bothHaveContent = 0;
        let hebrewInFirst = 0;
        let hebrewInSecond = 0;
        
        const maxLength = Math.max(row1.length, row2.length);
        
        for (let i = 0; i < maxLength; i++) {
            const cell1 = (row1[i] || '').trim();
            const cell2 = (row2[i] || '').trim();
            
            if (!cell1 && cell2) emptyInFirst++;
            else if (cell1 && !cell2) emptyInSecond++;
            else if (cell1 && cell2) bothHaveContent++;
            
            if (/[\u0590-\u05FF]/.test(cell1)) hebrewInFirst++;
            if (/[\u0590-\u05FF]/.test(cell2)) hebrewInSecond++;
        }
        
        // Hebrew-specific merge logic
        const totalCells = maxLength;
        const complementary = (emptyInFirst + emptyInSecond) / totalCells;
        const overlap = bothHaveContent / totalCells;
        const hebrewPresent = (hebrewInFirst + hebrewInSecond) > 0;
        
        // More lenient merging for Hebrew headers
        const shouldMerge = hebrewPresent && complementary > 0.4 && overlap < 0.4;
        
        this.log('Hebrew row merge analysis - complementary: ' + complementary.toFixed(2) + 
                ', overlap: ' + overlap.toFixed(2) + ', Hebrew present: ' + hebrewPresent + 
                ', should merge: ' + shouldMerge);
        
        return shouldMerge;
    }

    normalizeTable(tableData) {
        if (!tableData || tableData.length === 0) return [];

        this.log('Normalizing table with ' + tableData.length + ' rows');
        
        // Remove completely empty rows
        const nonEmptyRows = tableData.filter(row => 
            row.some(cell => cell && cell.trim().length > 0)
        );
        
        if (nonEmptyRows.length === 0) return [];
        
        // Find maximum column count
        const maxColumns = Math.max(...nonEmptyRows.map(row => row.length));
        this.log('Maximum columns detected: ' + maxColumns);
        
        // Clean and normalize each row
        const normalizedTable = nonEmptyRows.map((row, rowIndex) => {
            // Pad row to have consistent column count
            const paddedRow = [...row];
            while (paddedRow.length < maxColumns) {
                paddedRow.push('');
            }
            
            // Clean cell data
            return paddedRow.map(cell => {
                if (!cell) return '';
                
                // Clean up the cell content
                let cleanCell = cell.toString().trim();
                
                // Remove extra whitespace
                cleanCell = cleanCell.replace(/\s+/g, ' ');
                
                // Handle common OCR errors for Hebrew
                cleanCell = cleanCell.replace(/[״"]/g, '"'); // Normalize quotes
                cleanCell = cleanCell.replace(/[׳']/g, "'"); // Normalize apostrophes
                
                return cleanCell;
            });
        });
        
        // Try to detect and merge header rows that might be split
        const mergedTable = this.mergeHeaderRows(normalizedTable);
        
        // Filter out rows that are likely to be artifacts (very short or repetitive)
        const filteredTable = mergedTable.filter((row, index) => {
            const nonEmptyCells = row.filter(cell => cell.trim().length > 0);
            
            // Keep rows with at least 2 non-empty cells, unless it's the only row
            if (nonEmptyCells.length < 2 && mergedTable.length > 1) {
                this.log('Filtering out row ' + (index + 1) + ' (too few cells): ' + JSON.stringify(row));
                return false;
            }
            
            return true;
        });
        
        this.log('Normalized table: ' + filteredTable.length + ' rows');
        return filteredTable;
    }
    
    // Merge potential split header rows
    mergeHeaderRows(tableData) {
        if (tableData.length < 2) return tableData;
        
        const result = [...tableData];
        
        // Check if first few rows might be split headers
        for (let i = 0; i < Math.min(3, result.length - 1); i++) {
            const currentRow = result[i];
            const nextRow = result[i + 1];
            
            // Check if rows should be merged (e.g., header split across multiple lines)
            if (this.shouldMergeRows(currentRow, nextRow)) {
                this.log('Merging rows ' + (i + 1) + ' and ' + (i + 2));
                
                // Merge the rows
                const mergedRow = currentRow.map((cell, colIndex) => {
                    const currentCell = cell || '';
                    const nextCell = nextRow[colIndex] || '';
                    
                    if (!currentCell && nextCell) return nextCell;
                    if (currentCell && !nextCell) return currentCell;
                    if (!currentCell && !nextCell) return '';
                    
                    // Both have content - combine with space
                    return (currentCell + ' ' + nextCell).trim();
                });
                
                result[i] = mergedRow;
                result.splice(i + 1, 1); // Remove the merged row
                i--; // Recheck from same position
            }
        }
        
        return result;
    }
    
    // Determine if two rows should be merged
    shouldMergeRows(row1, row2) {
        if (!row1 || !row2) return false;
        
        let emptyInFirst = 0;
        let emptyInSecond = 0;
        let bothHaveContent = 0;
        
        const maxLength = Math.max(row1.length, row2.length);
        
        for (let i = 0; i < maxLength; i++) {
            const cell1 = (row1[i] || '').trim();
            const cell2 = (row2[i] || '').trim();
            
            if (!cell1 && cell2) emptyInFirst++;
            else if (cell1 && !cell2) emptyInSecond++;
            else if (cell1 && cell2) bothHaveContent++;
        }
        
        // Merge if they complement each other (one has content where other is empty)
        // and there's not too much overlap
        const totalCells = maxLength;
        const complementary = (emptyInFirst + emptyInSecond) / totalCells;
        const overlap = bothHaveContent / totalCells;
        
        const shouldMerge = complementary > 0.5 && overlap < 0.3;
        this.log('Row merge analysis - complementary: ' + complementary.toFixed(2) + 
                ', overlap: ' + overlap.toFixed(2) + ', should merge: ' + shouldMerge);
        
        return shouldMerge;
    }

    async displayResults() {
        if (this.processedData.length === 0) {
            this.showError('אין נתונים להצגה');
            return;
        }

        const successfulData = this.processedData.filter(item => item.success);
        
        if (successfulData.length === 0) {
            this.showError('כל הקבצים נכשלו בעיבוד');
            return;
        }

        const firstResult = successfulData[0];
        this.displayPreview(firstResult.data);

        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
        }

        const downloadContainer = document.getElementById('downloadContainer');
        if (downloadContainer) {
            downloadContainer.style.display = 'block';
        }

        this.log('Results displayed successfully');
    }

    displayPreview(data) {
        this.log('Displaying preview with ' + data.length + ' rows', 'debug');
        
        const previewTable = document.getElementById('previewTable');
        if (!previewTable || !data || data.length === 0) {
            this.log('Cannot display preview - missing table element or data', 'warn');
            return;
        }

        const thead = previewTable.querySelector('thead');
        const tbody = previewTable.querySelector('tbody');

        thead.innerHTML = '';
        tbody.innerHTML = '';

        const maxCols = Math.max(...data.map(row => row.length));
        this.log('Preview table will have ' + maxCols + ' columns', 'debug');
        
        const headerRow = document.createElement('tr');
        for (let i = 0; i < maxCols; i++) {
            const th = document.createElement('th');
            th.textContent = `עמודה ${i + 1}`;
            th.className = 'text-center';
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);

        const rowsToShow = Math.min(10, data.length);
        this.log('Showing first ' + rowsToShow + ' rows in preview', 'debug');

        for (let i = 0; i < rowsToShow; i++) {
            const rowData = data[i];
            const tr = document.createElement('tr');
            
            this.log('Preview row ' + (i + 1) + ': ' + JSON.stringify(rowData), 'debug');
            
            for (let j = 0; j < maxCols; j++) {
                const td = document.createElement('td');
                td.textContent = rowData[j] || '';
                td.className = 'text-start';
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        }
        
        this.log('Preview displayed successfully', 'success');
    }

    async downloadFile() {
        if (this.processedData.length === 0) {
            this.showError('אין נתונים להורדה');
            return;
        }

        const format = document.getElementById('outputFormat')?.value || 'xlsx';
        const successfulData = this.processedData.filter(item => item.success);

        if (successfulData.length === 0) {
            this.showError('אין נתונים תקינים להורדה');
            return;
        }

        try {
            const fileData = successfulData[0];
            await this.exportFile(fileData, format);
        } catch (error) {
            this.showError(`שגיאה בהורדה: ${error.message}`);
            this.log(`Download error: ${error.message}`, 'error');
        }
    }

    async exportFile(fileData, format) {
        const exporter = this.exporters[format];
        
        if (!exporter) {
            throw new Error(`Unsupported export format: ${format}`);
        }

        const filename = this.generateFilename(fileData.fileName, format);
        const options = this.getExportOptions(format);
        options.fileName = filename;
        
        await exporter.export(fileData.data, options);
        
        this.log(`Exported ${filename} successfully`);
    }

    getExportOptions(format) {
        const options = {};
        
        switch (format) {
            case 'xlsx':
                options.headers = document.getElementById('xlsxHeaders')?.checked !== false;
                options.formatting = document.getElementById('xlsxFormatting')?.checked !== false;
                break;
                
            case 'csv':
                options.delimiter = document.getElementById('csvDelimiter')?.value || ',';
                options.bom = document.getElementById('csvBOM')?.checked !== false;
                break;
                
            case 'docx':
                options.asTable = document.getElementById('docxTable')?.checked !== false;
                options.rtl = document.getElementById('docxRTL')?.checked !== false;
                options.fontSize = parseInt(document.getElementById('docxFontSize')?.value || '12');
                options.fontFamily = document.getElementById('docxFont')?.value || 'David';
                break;
        }
        
        return options;
    }

    generateFilename(originalFilename, format) {
        const baseName = originalFilename.replace(/\.[^/.]+$/, '');
        return `${baseName}.${format}`;
    }

    resetToNewFile() {
        this.files = [];
        this.processedData = [];
        this.isProcessing = false;
        
        const fileListContainer = document.getElementById('fileList');
        if (fileListContainer) {
            fileListContainer.innerHTML = '';
        }
        
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        const batchFileInput = document.getElementById('batchFileInput');
        if (batchFileInput) {
            batchFileInput.value = '';
        }
        
        this.hideProgress();
        this.hideError();
        
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
        
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.style.display = 'none';
        }
        
        this.log('Reset to new file state');
    }

    showProgress() {
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
    }

    hideProgress() {
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    updateProgress(percent, message) {
        const progressBar = document.getElementById('progressBar');
        const progressMessage = document.getElementById('progressMessage');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.setAttribute('aria-valuenow', percent);
        }
        
        if (progressMessage && message) {
            progressMessage.textContent = message;
        }
    }

    updateCurrentFile(filename) {
        const currentFile = document.getElementById('currentFile');
        if (currentFile) {
            currentFile.textContent = `קובץ נוכחי: ${filename}`;
        }
    }

    showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorContainer && errorMessage) {
            errorMessage.textContent = message;
            errorContainer.style.display = 'block';
        }
        
        this.log(`Error: ${message}`, 'error');
    }

    hideError() {
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, isBatch) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        this.handleFileSelect(files, isBatch);
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[PDFConverter] ${message}`;
        
        // Console logging
        if (level === 'error') {
            console.error(logMessage);
        } else if (level === 'warn') {
            console.warn(logMessage);
        } else {
            console.log(logMessage);
        }
        
        // Debug console logging
        if (typeof window.addDebugLog === 'function') {
            window.addDebugLog(message, level);
        }
    }

    async cleanup() {
        if (this.tesseractWorker) {
            try {
                await this.tesseractWorker.terminate();
                this.tesseractWorker = null;
                this.log('Tesseract worker terminated');
            } catch (error) {
                this.log(`Error terminating Tesseract worker: ${error.message}`, 'warn');
            }
        }
    }
}

// Export globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFConverterCore;
} else {
    window.PDFConverterCore = PDFConverterCore;
}

// Auto cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.pdfConverter && typeof window.pdfConverter.cleanup === 'function') {
        window.pdfConverter.cleanup();
    }
});
