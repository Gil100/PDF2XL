// Core Module - ליבת המערכת המחודשת
// js/core.js

class PDFConverterCore {
    constructor() {
        this.files = [];
        this.processedData = [];
        this.tesseractWorker = null;
        this.isProcessing = false;
        this.exporters = {};
        this.supportedFormats = ['xlsx', 'csv', 'docx'];
        
        this.initializeExporters();
        this.initializeEventListeners();
        this.initializeTesseract();
        
        // Hide error section on initial load
        this.hideError();
    }

    // אתחול מודולי הייצוא
    async initializeExporters() {
        try {
            this.log('Initializing exporters...');
            
            // יצירת מופעים של כל המייצאים
            this.exporters = {
                'xlsx': new ExcelExporter(),
                'csv': new CSVExporter(),
                'docx': new DOCXExporter()
            };

            // אתחול מקביל של כל המייצאים עם timeout
            const initPromises = Object.entries(this.exporters).map(async ([format, exporter]) => {
                try {
                    await Promise.race([
                        exporter.ensureReady(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error(`${format} exporter timeout`)), 10000)
                        )
                    ]);
                    this.log(`${format} exporter initialized successfully`);
                } catch (error) {
                    this.log(`${format} exporter initialization failed: ${error.message}`, 'warn');
                    // עבור DOCX, זה לא קריטי כי יש fallback
                    if (format !== 'docx') {
                        throw error;
                    }
                }
            });

            await Promise.allSettled(initPromises);
            this.log('Exporters initialization completed');
            
            // בדיקה מיוחדת עבור DOCX
            this.checkDOCXAvailability();
            
        } catch (error) {
            this.log(`Failed to initialize exporters: ${error.message}`, 'error');
            this.showError('שגיאה באתחול מודולי הייצוא');
        }
    }

    // בדיקת זמינות DOCX
    checkDOCXAvailability() {
        const docxExporter = this.exporters.docx;
        if (docxExporter && docxExporter.isDocxAvailable && docxExporter.isDocxAvailable()) {
            this.log('DOCX export fully available');
        } else {
            this.log('DOCX export will use fallback method', 'warn');
        }
    }

    // אתחול Tesseract OCR worker
    async initializeTesseract() {
        try {
            this.tesseractWorker = await Tesseract.createWorker('heb+eng', 1, {
                logger: (info) => {
                    if (info.status === 'recognizing text') {
                        this.updateProgress(info.progress * 50, 'מזהה טקסט...');
                    }
                }
            });
            this.log('Tesseract worker initialized successfully');
        } catch (error) {
            this.log('Failed to initialize Tesseract:', 'error');
            this.showError('שגיאה באתחול מנוע OCR');
        }
    }

    // אתחול event listeners
    initializeEventListeners() {
        // קישור לרכיבי הממשק
        this.bindFileInputs();
        this.bindDragAndDrop();
        this.bindButtons();
        this.bindFormatSelection();
    }

    bindFileInputs() {
        const fileInput = document.getElementById('fileInput');
        const batchFileInput = document.getElementById('batchFileInput');
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files, false));
        }
        
        if (batchFileInput) {
            batchFileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files, true));
        }
    }

    bindDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        const batchDropZone = document.getElementById('batchDropZone');

        if (dropZone) {
            dropZone.addEventListener('dragover', this.handleDragOver);
            dropZone.addEventListener('dragleave', this.handleDragLeave);
            dropZone.addEventListener('drop', (e) => this.handleDrop(e, false));
        }

        if (batchDropZone) {
            batchDropZone.addEventListener('dragover', this.handleDragOver);
            batchDropZone.addEventListener('dragleave', this.handleDragLeave);
            batchDropZone.addEventListener('drop', (e) => this.handleDrop(e, true));
        }
    }

    bindButtons() {
        const processBtn = document.getElementById('processBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const newFileBtn = document.getElementById('newFileBtn');
        const newFileBtn2 = document.getElementById('newFileBtn2');

        if (processBtn) {
            processBtn.addEventListener('click', () => this.processFiles());
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadFile());
        }
        
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', () => this.downloadAllFiles());
        }
        
        if (newFileBtn) {
            newFileBtn.addEventListener('click', () => this.resetToNewFile());
        }
        
        if (newFileBtn2) {
            newFileBtn2.addEventListener('click', () => this.resetToNewFile());
        }
    }

    bindFormatSelection() {
        const outputFormat = document.getElementById('outputFormat');
        
        if (outputFormat) {
            outputFormat.addEventListener('change', (e) => {
                this.handleFormatChange(e.target.value);
            });
        }
    }

    // טיפול בשינוי פורמט הפלט
    handleFormatChange(format) {
        this.log(`Output format changed to: ${format}`, 'debug');
        
        // הצגה/הסתרה של אפשרויות ספציפיות לפורמט
        this.toggleFormatOptions(format);
        
        // עדכון תצוגה מקדימה אם קיימת
        if (this.processedData.length > 0) {
            this.updatePreviewForFormat(format);
        }
    }

    toggleFormatOptions(format) {
        // הסתרת כל האפשרויות הספציפיות
        const optionSections = ['xlsxOptions', 'csvOptions', 'docxOptions'];
        optionSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'none';
            }
        });

        // הצגת האפשרויות הרלוונטיות
        const currentOptions = document.getElementById(`${format}Options`);
        if (currentOptions) {
            currentOptions.style.display = 'block';
        }
    }

    // עיבוד קבצים - פונקציה עיקרית
    async processFiles() {
        if (this.files.length === 0 || this.isProcessing) return;

        this.isProcessing = true;
        this.processedData = [];
        this.updateProcessButton();
        this.showProgress();
        this.hideError();

        try {
            this.log(`Starting to process ${this.files.length} files`);
            
            for (let i = 0; i < this.files.length; i++) {
                const file = this.files[i];
                this.updateCurrentFile(file.name);
                this.updateFileStatus(i, 'processing');

                try {
                    const result = await this.processSingleFile(file, i);
                    this.processedData.push(result);
                    this.updateFileStatus(i, 'completed');
                    
                } catch (error) {
                    this.log(`Error processing ${file.name}: ${error.message}`, 'error');
                    this.updateFileStatus(i, 'error');
                    this.showError(`שגיאה בעיבוד ${file.name}: ${error.message}`);
                }
            }

            if (this.processedData.length > 0) {
                this.showPreview();
                this.showDownloadButtons();
                this.log(`Successfully processed ${this.processedData.length} files`);
            }

        } catch (error) {
            this.log(`Processing error: ${error.message}`, 'error');
            this.showError(`שגיאה כללית: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateProcessButton();
            this.hideProgress();
        }
    }

    // עיבוד קובץ PDF יחיד
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

        // אימות נתונים אם מופעל
        if (document.getElementById('dataValidation')?.checked) {
            allData = this.validateData(allData);
        }

        return {
            fileName: file.name,
            data: allData,
            pages: totalPages
        };
    }

    // עיבוד עמוד יחיד
    async processPage(page) {
        try {
            // ניסיון חילוץ טקסט ישירות
            const textContent = await page.getTextContent();
            
            if (textContent.items.length > 0) {
                return this.extractTableFromText(textContent);
            } else {
                // חזרה ל-OCR אם אין תוכן טקסט
                return await this.extractTableFromOCR(page);
            }
        } catch (error) {
            this.log('Error processing page:', 'error');
            // ניסיון OCR כחלופה
            return await this.extractTableFromOCR(page);
        }
    }

    // חילוץ טבלה מתוכן טקסט
    extractTableFromText(textContent) {
        const items = textContent.items;
        const lines = [];
        
        // קיבוץ פריטי טקסט לפי קואורדינטת Y (שורות)
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

        // מיון שורות לפי קואורדינטת Y (מלמעלה למטה)
        const sortedLines = Array.from(lineMap.entries())
            .sort((a, b) => b[0] - a[0]) // Y יורד (מלמעלה למטה)
            .map(([y, lineItems]) => {
                // מיון פריטים בכל שורה לפי קואורדינטת X (משמאל לימין)
                return lineItems.sort((a, b) => a.x - b.x);
            });

        // המרה לפורמט טבלה
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

    // חילוץ טבלה באמצעות OCR
    async extractTableFromOCR(page) {
        if (!this.tesseractWorker) {
            throw new Error('OCR worker not initialized');
        }

        // רינדור עמוד לcanvas
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // קבלת הגדרות שפת OCR
        const ocrLanguage = document.getElementById('ocrLanguage')?.value || 'heb+eng';
        
        // ביצוע OCR
        const { data: { text } } = await this.tesseractWorker.recognize(canvas, {
            lang: ocrLanguage
        });

        return this.parseOCRText(text);
    }

    // ניתוח טקסט OCR לפורמט טבלה
    parseOCRText(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const tableData = [];

        lines.forEach(line => {
            // פיצול לפי רווחים מרובים או טאבים כדי לזהות עמודות
            const cells = line.split(/\s{2,}|\t/).filter(cell => cell.trim());
            if (cells.length > 0) {
                tableData.push(cells.map(cell => cell.trim()));
            }
        });

        return this.normalizeTable(tableData);
    }

    // נרמול נתוני טבלה (וידוא מספר עמודות עקבי)
    normalizeTable(tableData) {
        if (tableData.length === 0) return [];

        // מציאת מספר העמודות המקסימלי
        const maxColumns = Math.max(...tableData.map(row => row.length));
        
        // השלמת שורות למספר עמודות עקבי
        return tableData.map(row => {
            while (row.length < maxColumns) {
                row.push('');
            }
            return row;
        });
    }

    // ייצוא באמצעות המודולים החדשים
    async exportWithFormat(data, format, options = {}) {
        try {
            const exporter = this.exporters[format];
            
            if (!exporter) {
                throw new Error(`פורמט לא נתמך: ${format}`);
            }

            this.log(`Exporting with ${format} format`, 'debug');
            
            // הכנת אפשרויות הייצוא
            const exportOptions = this.prepareExportOptions(format, options);
            
            // ביצוע הייצוא
            const result = await exporter.export(data, exportOptions);
            
            this.log(`Export completed: ${result.fileName}`);
            return result;
            
        } catch (error) {
            this.log(`Export failed: ${error.message}`, 'error');
            throw error;
        }
    }

    // הכנת אפשרויות ייצוא לפי הפורמט
    prepareExportOptions(format, baseOptions = {}) {
        const commonOptions = {
            fileName: baseOptions.fileName,
            ...baseOptions
        };

        switch (format) {
            case 'xlsx':
                return {
                    ...commonOptions,
                    hasHeaders: document.getElementById('xlsxHeaders')?.checked ?? true,
                    formatting: document.getElementById('xlsxFormatting')?.checked ?? true,
                    columnWidths: baseOptions.columnWidths
                };

            case 'csv':
                return {
                    ...commonOptions,
                    delimiter: document.getElementById('csvDelimiter')?.value || ',',
                    bom: document.getElementById('csvBOM')?.checked ?? true,
                    encoding: 'utf-8'
                };

            case 'docx':
                return {
                    ...commonOptions,
                    rtl: document.getElementById('docxRTL')?.checked ?? true,
                    asTable: document.getElementById('docxTable')?.checked ?? true,
                    fontSize: parseInt(document.getElementById('docxFontSize')?.value) || 12,
                    fontFamily: document.getElementById('docxFont')?.value || 'David',
                    title: baseOptions.title || 'מסמך מומר מ-PDF'
                };

            default:
                return commonOptions;
        }
    }

    // הורדת קובץ יחיד
    async downloadFile() {
        if (this.processedData.length === 0) return;

        try {
            const fileData = this.processedData[0];
            const format = document.getElementById('outputFormat')?.value || 'xlsx';
            
            // הודעה מיוחדת עבור DOCX
            if (format === 'docx') {
                this.showInfo('מתחיל יצוא לפורמט Word. יצירת הקובץ תלויה בזמינות הספרייה.');
            }
            
            const result = await this.exportWithFormat(fileData.data, format, {
                fileName: fileData.fileName.replace('.pdf', '')
            });
            
            // הודעה על הצלחה עם פרטים
            if (result.note) {
                this.showInfo(result.note);
            } else {
                this.showInfo(`הקובץ ${result.fileName} נוצר בהצלחה`);
            }
            
        } catch (error) {
            console.error("Download error:", error);
            this.showError(`שגיאה בהורדה: ${error.message}`);
        }
    }

    // הורדת כל הקבצים
    async downloadAllFiles() {
        if (this.processedData.length === 0) return;

        try {
            const format = document.getElementById('outputFormat')?.value || 'xlsx';
            
            // הורדה רציפה עם השהיה בין קבצים
            for (let i = 0; i < this.processedData.length; i++) {
                const fileData = this.processedData[i];
                
                await this.exportWithFormat(fileData.data, format, {
                    fileName: `${fileData.fileName.replace('.pdf', '')}_${i + 1}`
                });
                
                // השהיה בין הורדות למניעת חסימה של הדפדפן
                if (i < this.processedData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
        } catch (error) {
            this.showError(`שגיאה בהורדת קבצים: ${error.message}`);
        }
    }

    // פונקציות עזר
    
    handleFileSelect(files, isBatch) {
        if (!files || files.length === 0) return;

        const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        
        if (validFiles.length === 0) {
            this.showError('אנא בחר קבצי PDF בלבד');
            return;
        }

        if (!isBatch) {
            this.files = [validFiles[0]]; // מצב קובץ יחיד
        } else {
            this.files = [...this.files, ...validFiles]; // מצב קבוצתי
        }

        this.updateFileList();
        this.updateProcessButton();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e, isBatch) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
        this.handleFileSelect(files, isBatch);
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileList();
        this.updateProcessButton();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateProcessButton() {
        const processBtn = document.getElementById('processBtn');
        const newFileBtn = document.getElementById('newFileBtn');
        
        if (processBtn) {
            processBtn.disabled = this.files.length === 0 || this.isProcessing;
        }
        
        // הצגת כפתור "קובץ חדש" כשיש קבצים
        if (newFileBtn) {
            newFileBtn.style.display = this.files.length > 0 ? 'inline-block' : 'none';
        }
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        
        if (!fileList) return;
        
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

    updateFileStatus(index, status) {
        const fileItem = document.querySelector(`[data-index="${index}"] .file-status`);
        if (fileItem) {
            fileItem.className = `file-status status-${status}`;
            fileItem.textContent = this.getStatusText(status);
        }
    }

    getStatusText(status) {
        const statusTexts = {
            pending: 'ממתין',
            processing: 'מעבד...',
            completed: 'הושלם',
            error: 'שגיאה'
        };
        return statusTexts[status] || status;
    }

    showProgress() {
        const progressSection = document.getElementById('progressSection');
        const infoSection = document.getElementById('infoSection');
        if (progressSection) progressSection.style.display = 'block';
        if (infoSection) infoSection.style.display = 'none';
    }

    hideProgress() {
        const progressSection = document.getElementById('progressSection');
        const infoSection = document.getElementById('infoSection');
        if (progressSection) progressSection.style.display = 'none';
        if (infoSection) infoSection.style.display = 'block';
    }

    updateProgress(percentage, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${Math.round(percentage)}%`;
        }
        if (progressText) {
            progressText.textContent = text;
        }
    }

    updateCurrentFile(fileName) {
        const currentFile = document.getElementById('currentFile');
        if (currentFile) {
            currentFile.innerHTML = `<strong>קובץ נוכחי:</strong> ${fileName}`;
        }
    }

    showPreview() {
        const previewSection = document.getElementById('previewSection');
        const previewTable = document.getElementById('previewTable');
        
        if (!previewSection || !previewTable || this.processedData.length === 0) return;

        // שימוש בנתוני הקובץ הראשון לתצוגה מקדימה
        const firstFileData = this.processedData[0].data;
        
        if (firstFileData.length === 0) {
            previewSection.innerHTML = '<p class="text-center text-muted">לא נמצאו נתונים לתצוגה</p>';
            return;
        }

        // יצירת כותרות טבלה
        const maxColumns = Math.max(...firstFileData.map(row => row.length));
        const headers = Array.from({length: maxColumns}, (_, i) => `עמודה ${i + 1}`);
        
        const thead = previewTable.querySelector('thead');
        const tbody = previewTable.querySelector('tbody');
        
        if (thead) thead.innerHTML = `<tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>`;
        
        // הצגת 10 שורות ראשונות לתצוגה מקדימה
        const previewRows = firstFileData.slice(0, 10);
        if (tbody) {
            tbody.innerHTML = previewRows.map(row => 
                `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`
            ).join('');
        }

        previewSection.style.display = 'block';
    }

    showDownloadButtons() {
        const downloadBtn = document.getElementById('downloadBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const newFileBtn2 = document.getElementById('newFileBtn2');
        
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
        
        if (downloadAllBtn && this.processedData.length > 1) {
            downloadAllBtn.style.display = 'inline-block';
        }
        
        // הצגת כפתור "קובץ חדש" באזור ההורדות
        if (newFileBtn2) {
            newFileBtn2.style.display = 'inline-block';
        }
    }

    validateData(data) {
        // פונקציה זהה לקוד המקורי
        const validationResults = [];
        
        if (data.length === 0) {
            validationResults.push({
                type: 'error',
                message: 'לא נמצאו נתונים לעיבוד'
            });
            this.displayValidationResults(validationResults);
            return data;
        }

        // בדיקת שורות ריקות
        const emptyRows = data.filter(row => row.every(cell => !cell.trim())).length;
        if (emptyRows > 0) {
            validationResults.push({
                type: 'warning',
                message: `נמצאו ${emptyRows} שורות ריקות`
            });
        }

        // בדיקת מספר עמודות לא עקבי
        const columnCounts = data.map(row => row.length);
        const uniqueCounts = [...new Set(columnCounts)];
        if (uniqueCounts.length > 1) {
            validationResults.push({
                type: 'warning',
                message: 'מספר עמודות לא אחיד בין השורות'
            });
        }

        // בדיקת תוכן עברי
        const hasHebrew = data.some(row => 
            row.some(cell => /[\u0590-\u05FF]/.test(cell))
        );
        if (hasHebrew) {
            validationResults.push({
                type: 'success',
                message: 'זוהה תוכן בעברית'
            });
        }

        // בדיקת נתונים מספריים
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

    displayValidationResults(results) {
        const validationSection = document.getElementById('validationResults');
        
        if (!validationSection || results.length === 0) return;

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

    showError(message) {
        const errorSection = document.getElementById('errorSection');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorMessage) errorMessage.textContent = message;
        if (errorSection) errorSection.style.display = 'block';
    }

    hideError() {
        const errorSection = document.getElementById('errorSection');
        if (errorSection) errorSection.style.display = 'none';
    }

    showInfo(message) {
        // יצירת הודעת מידע זמנית
        const infoDiv = document.createElement('div');
        infoDiv.className = 'alert alert-info alert-dismissible fade show position-fixed';
        infoDiv.style.top = '20px';
        infoDiv.style.right = '20px';
        infoDiv.style.zIndex = '9999';
        infoDiv.style.maxWidth = '400px';
        
        infoDiv.innerHTML = `
            <i class="fas fa-info-circle"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(infoDiv);
        
        // הסרה אוטומטית אחרי 5 שניות
        setTimeout(() => {
            if (infoDiv.parentNode) {
                infoDiv.parentNode.removeChild(infoDiv);
            }
        }, 5000);
    }

    // אפיון מערכת לקובץ חדש
    resetToNewFile() {
        this.log('Resetting to new file mode', 'debug');
        
        // איפוס כל הנתונים
        this.files = [];
        this.processedData = [];
        
        // איפוס ממשק המשתמש
        this.updateFileList();
        this.updateProcessButton();
        this.hideProgress();
        this.hideError();
        this.hidePreview();
        this.hideDownloadButtons();
        this.hideNewFileButtons();
        
        // איפוס שדות הקלט
        this.resetFileInputs();
        
        // הצגת חזרה לרכיב המידע
        const infoSection = document.getElementById('infoSection');
        if (infoSection) {
            infoSection.style.display = 'block';
        }
        
        // הודעת מידע למשתמש
        this.showInfo('המערכת אופסה - ניתן להעלות קבצים חדשים');
        
        this.log('System reset completed');
    }

    // הסתרת תצוגה מקדימה
    hidePreview() {
        const previewSection = document.getElementById('previewSection');
        if (previewSection) {
            previewSection.style.display = 'none';
        }
    }

    // הסתרת כפתורי הורדה
    hideDownloadButtons() {
        const downloadBtn = document.getElementById('downloadBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (downloadAllBtn) downloadAllBtn.style.display = 'none';
    }

    // הסתרת כפתורי "קובץ חדש"
    hideNewFileButtons() {
        const newFileBtn = document.getElementById('newFileBtn');
        const newFileBtn2 = document.getElementById('newFileBtn2');
        
        if (newFileBtn) newFileBtn.style.display = 'none';
        if (newFileBtn2) newFileBtn2.style.display = 'none';
    }

    // איפוס שדות העלאת קבצים
    resetFileInputs() {
        const fileInput = document.getElementById('fileInput');
        const batchFileInput = document.getElementById('batchFileInput');
        
        if (fileInput) fileInput.value = '';
        if (batchFileInput) batchFileInput.value = '';
        
        // הסרת מחלקות drag-over ואפקט איפוס
        const dropZone = document.getElementById('dropZone');
        const batchDropZone = document.getElementById('batchDropZone');
        
        if (dropZone) {
            dropZone.classList.remove('dragover');
            dropZone.classList.add('reset-animation');
            setTimeout(() => dropZone.classList.remove('reset-animation'), 500);
        }
        
        if (batchDropZone) {
            batchDropZone.classList.remove('dragover');
            batchDropZone.classList.add('reset-animation');
            setTimeout(() => batchDropZone.classList.remove('reset-animation'), 500);
        }
    }
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[PDFConverter] ${timestamp}:`;
        
        switch (level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            case 'debug':
                if (window.DEBUG_MODE) console.debug(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }
}
function downloadAsExcel(data, fileName) {
    if (window.converter && window.converter.exporters.xlsx) {
        return window.converter.exporters.xlsx.export(data, { fileName });
    }
    // fallback לקוד הישן
    const exporter = new ExcelExporter();
    return exporter.export(data, { fileName });
}

function downloadAsCSV(data, fileName) {
    if (window.converter && window.converter.exporters.csv) {
        return window.converter.exporters.csv.export(data, { fileName });
    }
    // fallback לקוד הישן
    const exporter = new CSVExporter();
    return exporter.export(data, { fileName });
}

function downloadAsDOCX(data, fileName) {
    if (window.converter && window.converter.exporters.docx) {
        return window.converter.exporters.docx.export(data, { fileName });
    }
    // fallback לקוד הישן
    const exporter = new DOCXExporter();
    return exporter.export(data, { fileName });
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFConverterCore;
} else {
    window.PDFConverterCore = PDFConverterCore;
    // תאימות לאחור
    window.downloadAsExcel = downloadAsExcel;
    window.downloadAsCSV = downloadAsCSV;
    window.downloadAsDOCX = downloadAsDOCX;
}