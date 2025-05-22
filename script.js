// PDF to Excel/CSV Converter with Hebrew OCR Support
// Main JavaScript file

class PDFConverter {
    constructor() {
        this.files = [];
        this.processedData = [];
        this.tesseractWorker = null;
        this.isProcessing = false;
        
        this.initializeEventListeners();
        this.initializeTesseract();
    }

    // Initialize Tesseract OCR worker
    async initializeTesseract() {
        try {
            this.tesseractWorker = await Tesseract.createWorker('heb+eng', 1, {
                logger: (info) => {
                    if (info.status === 'recognizing text') {
                        this.updateProgress(info.progress * 50, 'מזהה טקסט...');
                    }
                }
            });
            console.log('Tesseract worker initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Tesseract:', error);
            this.showError('שגיאה באתחול מנוע OCR');
        }
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // File input listeners
        const fileInput = document.getElementById('fileInput');
        const batchFileInput = document.getElementById('batchFileInput');
        const dropZone = document.getElementById('dropZone');
        const batchDropZone = document.getElementById('batchDropZone');
        const processBtn = document.getElementById('processBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');

        // Single file upload
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files, false));
        
        // Batch file upload
        batchFileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files, true));

        // Drag and drop for single file
        dropZone.addEventListener('dragover', this.handleDragOver);
        dropZone.addEventListener('dragleave', this.handleDragLeave);
        dropZone.addEventListener('drop', (e) => this.handleDrop(e, false));

        // Drag and drop for batch
        batchDropZone.addEventListener('dragover', this.handleDragOver);
        batchDropZone.addEventListener('dragleave', this.handleDragLeave);
        batchDropZone.addEventListener('drop', (e) => this.handleDrop(e, true));

        // Process button
        processBtn.addEventListener('click', () => this.processFiles());

        // Download buttons
        downloadBtn.addEventListener('click', () => this.downloadFile());
        downloadAllBtn.addEventListener('click', () => this.downloadAllFiles());
    }

    // Handle drag over event
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    // Handle drag leave event
    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    // Handle drop event
    handleDrop(e, isBatch) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
        this.handleFileSelect(files, isBatch);
    }

    // Handle file selection
    handleFileSelect(files, isBatch) {
        if (!files || files.length === 0) return;

        const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        
        if (validFiles.length === 0) {
            this.showError('אנא בחר קבצי PDF בלבד');
            return;
        }

        if (!isBatch) {
            this.files = [validFiles[0]]; // Single file mode
        } else {
            this.files = [...this.files, ...validFiles]; // Batch mode
        }

        this.updateFileList();
        this.updateProcessButton();
    }

    // Update file list display
    updateFileList() {
        const fileList = document.getElementById('fileList');
        
        if (this.files.length === 0) {
            fileList.innerHTML = '';
            return;
        }

        const html = this.files.map((file, index) => `
            <div class="file-item fade-in" data-index="${index}">
                <div class="file-info">
                    <i class="fas fa-file-pdf text-danger"></i>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${this.formatFileSize(file.size)})</span>
                </div>
                <div class="file-actions">
                    <span class="file-status status-pending">ממתין</span>
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="converter.removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');

        fileList.innerHTML = html;
    }

    // Remove file from list
    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileList();
        this.updateProcessButton();
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Update process button state
    updateProcessButton() {
        const processBtn = document.getElementById('processBtn');
        processBtn.disabled = this.files.length === 0 || this.isProcessing;
    }

    // Process all files
    async processFiles() {
        if (this.files.length === 0 || this.isProcessing) return;

        this.isProcessing = true;
        this.processedData = [];
        this.updateProcessButton();
        this.showProgress();
        this.hideError();

        try {
            for (let i = 0; i < this.files.length; i++) {
                const file = this.files[i];
                this.updateCurrentFile(file.name);
                this.updateFileStatus(i, 'processing');

                try {
                    const result = await this.processSingleFile(file, i);
                    this.processedData.push(result);
                    this.updateFileStatus(i, 'completed');
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    this.updateFileStatus(i, 'error');
                    this.showError(`שגיאה בעיבוד ${file.name}: ${error.message}`);
                }
            }

            if (this.processedData.length > 0) {
                this.showPreview();
                this.showDownloadButtons();
            }

        } catch (error) {
            console.error('Processing error:', error);
            this.showError(`שגיאה כללית: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateProcessButton();
            this.hideProgress();
        }
    }

    // Process a single PDF file
    async processSingleFile(file, fileIndex) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const totalPages = pdf.numPages;
        let allData = [];
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            this.updateProgress(
                ((fileIndex / this.files.length) + (pageNum / totalPages / this.files.length)) * 100,
                `מעבד עמוד ${pageNum} מתוך ${totalPages} - ${file.name}`
            );

            const page = await pdf.getPage(pageNum);
            const pageData = await this.processPage(page);
            
            if (pageData && pageData.length > 0) {
                allData = allData.concat(pageData);
            }
        }

        // Data validation if enabled
        if (document.getElementById('dataValidation').checked) {
            allData = this.validateData(allData);
        }

        return {
            fileName: file.name,
            data: allData,
            pages: totalPages
        };
    }

    // Process a single page
    async processPage(page) {
        try {
            // Try to extract text directly first
            const textContent = await page.getTextContent();
            
            if (textContent.items.length > 0) {
                return this.extractTableFromText(textContent);
            } else {
                // Fallback to OCR if no text content
                return await this.extractTableFromOCR(page);
            }
        } catch (error) {
            console.error('Error processing page:', error);
            // Try OCR as fallback
            return await this.extractTableFromOCR(page);
        }
    }

    // Extract table data from text content
    extractTableFromText(textContent) {
        const items = textContent.items;
        const lines = [];
        
        // Group text items by Y coordinate (rows)
        const lineMap = new Map();
        
        items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!lineMap.has(y)) {
                lineMap.set(y, []);
            }
            lineMap.get(y).push({
                text: item.str,
                x: item.transform[4],
                width: item.width
            });
        });

        // Sort lines by Y coordinate (top to bottom)
        const sortedLines = Array.from(lineMap.entries())
            .sort((a, b) => b[0] - a[0]) // Descending Y (top to bottom)
            .map(([y, lineItems]) => {
                // Sort items in each line by X coordinate (left to right)
                return lineItems.sort((a, b) => a.x - b.x);
            });

        // Convert to table format
        const tableData = [];
        sortedLines.forEach(lineItems => {
            const row = [];
            lineItems.forEach(item => {
                if (item.text.trim()) {
                    row.push(item.text.trim());
                }
            });
            if (row.length > 0) {
                tableData.push(row);
            }
        });

        return this.normalizeTable(tableData);
    }

    // Extract table data using OCR
    async extractTableFromOCR(page) {
        if (!this.tesseractWorker) {
            throw new Error('OCR worker not initialized');
        }

        // Render page to canvas
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Get OCR language setting
        const ocrLanguage = document.getElementById('ocrLanguage').value;
        
        // Perform OCR
        const { data: { text } } = await this.tesseractWorker.recognize(canvas, {
            lang: ocrLanguage
        });

        return this.parseOCRText(text);
    }

    // Parse OCR text into table format
    parseOCRText(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const tableData = [];

        lines.forEach(line => {
            // Split by multiple spaces or tabs to detect columns
            const cells = line.split(/\s{2,}|\t/).filter(cell => cell.trim());
            if (cells.length > 0) {
                tableData.push(cells.map(cell => cell.trim()));
            }
        });

        return this.normalizeTable(tableData);
    }

    // Normalize table data (ensure consistent column count)
    normalizeTable(tableData) {
        if (tableData.length === 0) return [];

        // Find maximum column count
        const maxColumns = Math.max(...tableData.map(row => row.length));
        
        // Pad rows to have consistent column count
        return tableData.map(row => {
            while (row.length < maxColumns) {
                row.push('');
            }
            return row;
        });
    }

    // Validate data
    validateData(data) {
        const validationResults = [];
        
        if (data.length === 0) {
            validationResults.push({
                type: 'error',
                message: 'לא נמצאו נתונים לעיבוד'
            });
            this.displayValidationResults(validationResults);
            return data;
        }

        // Check for empty rows
        const emptyRows = data.filter(row => row.every(cell => !cell.trim())).length;
        if (emptyRows > 0) {
            validationResults.push({
                type: 'warning',
                message: `נמצאו ${emptyRows} שורות ריקות`
            });
        }

        // Check for inconsistent column counts
        const columnCounts = data.map(row => row.length);
        const uniqueCounts = [...new Set(columnCounts)];
        if (uniqueCounts.length > 1) {
            validationResults.push({
                type: 'warning',
                message: 'מספר עמודות לא אחיד בין השורות'
            });
        }

        // Check for Hebrew content
        const hasHebrew = data.some(row => 
            row.some(cell => /[\u0590-\u05FF]/.test(cell))
        );
        if (hasHebrew) {
            validationResults.push({
                type: 'success',
                message: 'זוהה תוכן בעברית'
            });
        }

        // Check for numeric data
        const hasNumbers = data.some(row => 
            row.some(cell => /\d/.test(cell))
        );
        if (hasNumbers) {
            validationResults.push({
                type: 'success',
                message: 'זוהו נתונים מספריים'
            });
        }

        this.displayValidationResults(validationResults);
        return data;
    }

    // Display validation results
    displayValidationResults(results) {
        const validationSection = document.getElementById('validationResults');
        
        if (results.length === 0) {
            validationSection.innerHTML = '';
            return;
        }

        const html = `
            <h6><i class="fas fa-check-circle"></i> תוצאות אימות נתונים</h6>
            ${results.map(result => `
                <div class="validation-item validation-${result.type}">
                    <i class="fas fa-${result.type === 'error' ? 'exclamation-triangle' : 
                        result.type === 'warning' ? 'exclamation-circle' : 'check-circle'}"></i>
                    ${result.message}
                </div>
            `).join('')}
        `;

        validationSection.innerHTML = html;
    }

    // Update file status
    updateFileStatus(index, status) {
        const fileItem = document.querySelector(`[data-index="${index}"] .file-status`);
        if (fileItem) {
            fileItem.className = `file-status status-${status}`;
            fileItem.textContent = this.getStatusText(status);
        }
    }

    // Get status text
    getStatusText(status) {
        const statusTexts = {
            pending: 'ממתין',
            processing: 'מעבד...',
            completed: 'הושלם',
            error: 'שגיאה'
        };
        return statusTexts[status] || status;
    }

    // Show progress section
    showProgress() {
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('infoSection').style.display = 'none';
    }

    // Hide progress section
    hideProgress() {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('infoSection').style.display = 'block';
    }

    // Update progress
    updateProgress(percentage, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${Math.round(percentage)}%`;
        progressText.textContent = text;
    }

    // Update current file being processed
    updateCurrentFile(fileName) {
        const currentFile = document.getElementById('currentFile');
        currentFile.innerHTML = `<strong>קובץ נוכחי:</strong> ${fileName}`;
    }

    // Show preview of processed data
    showPreview() {
        const previewSection = document.getElementById('previewSection');
        const previewTable = document.getElementById('previewTable');
        
        if (this.processedData.length === 0) return;

        // Use first file's data for preview
        const firstFileData = this.processedData[0].data;
        
        if (firstFileData.length === 0) {
            previewSection.innerHTML = '<p class="text-center text-muted">לא נמצאו נתונים לתצוגה</p>';
            return;
        }

        // Create table headers
        const maxColumns = Math.max(...firstFileData.map(row => row.length));
        const headers = Array.from({length: maxColumns}, (_, i) => `עמודה ${i + 1}`);
        
        const thead = previewTable.querySelector('thead');
        const tbody = previewTable.querySelector('tbody');
        
        thead.innerHTML = `<tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>`;
        
        // Show first 10 rows for preview
        const previewRows = firstFileData.slice(0, 10);
        tbody.innerHTML = previewRows.map(row => 
            `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`
        ).join('');

        previewSection.style.display = 'block';
    }

    // Show download buttons
    showDownloadButtons() {
        const downloadBtn = document.getElementById('downloadBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        
        downloadBtn.style.display = 'inline-block';
        
        if (this.processedData.length > 1) {
            downloadAllBtn.style.display = 'inline-block';
        }
    }

    // Download single file (first processed file)
    downloadFile() {
        if (this.processedData.length === 0) return;
        
        const fileData = this.processedData[0];
        const outputFormat = document.getElementById('outputFormat').value;
        
        this.generateAndDownload(fileData, outputFormat);
    }

    // Download all files as ZIP
    async downloadAllFiles() {
        if (this.processedData.length === 0) return;

        // Note: For a complete ZIP implementation, you would need a library like JSZip
        // For now, we'll download files individually
        const outputFormat = document.getElementById('outputFormat').value;
        
        this.processedData.forEach((fileData, index) => {
            setTimeout(() => {
                this.generateAndDownload(fileData, outputFormat);
            }, index * 1000); // Stagger downloads to avoid browser blocking
        });
    }

    // Generate and download file
    generateAndDownload(fileData, format) {
        const data = fileData.data;
        const fileName = fileData.fileName.replace('.pdf', '');
        
        if (format === 'xlsx') {
            this.downloadAsExcel(data, fileName);
        } else {
            this.downloadAsCSV(data, fileName);
        }
    }

    // Download as Excel file
    downloadAsExcel(data, fileName) {
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        
        // Add RTL support for Hebrew
        if (!wb.Workbook) wb.Workbook = {};
        if (!wb.Workbook.Views) wb.Workbook.Views = [];
        wb.Workbook.Views[0] = { RTL: true };
        
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }

    // Download as CSV file
    downloadAsCSV(data, fileName) {
        const csvContent = data.map(row => 
            row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const blob = new Blob(['\ufeff' + csvContent], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Show error message
    showError(message) {
        const errorSection = document.getElementById('errorSection');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorSection.style.display = 'block';
    }

    // Hide error message
    hideError() {
        const errorSection = document.getElementById('errorSection');
        errorSection.style.display = 'none';
    }
}

// Initialize the converter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.converter = new PDFConverter();
    
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
});

// Utility functions for better user experience
function showTooltip(element, message) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip fade show bs-tooltip-top';
    tooltip.innerHTML = `
        <div class="tooltip-arrow"></div>
        <div class="tooltip-inner">${message}</div>
    `;
    
    document.body.appendChild(tooltip);
    
    setTimeout(() => {
        document.body.removeChild(tooltip);
    }, 3000);
}

// Error handling for uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    if (window.converter) {
        window.converter.showError('שגיאה לא צפויה. אנא נסה שוב.');
    }
});

// Handle promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.converter) {
        window.converter.showError('שגיאה בעיבוד. אנא נסה שוב.');
    }
    event.preventDefault();
});