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
        
        // הגדרות ביצועים וניטור
        this.enableMetrics = false; // ניתן להפעיל דרך ממשק המשתמש
        this.processingStats = {
            totalFiles: 0,
            totalPages: 0,
            totalProcessingTime: 0,
            averagePageTime: 0,
            methodsUsed: {}
        };
        
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

    // אתחול Tesseract OCR worker עם הגדרות מתקדמות
    async initializeTesseract() {
        try {
            this.log('Initializing Tesseract worker with advanced settings...');
            
            // יצירת worker עם הגדרות בסיסיות
            this.tesseractWorker = await Tesseract.createWorker('heb+eng', 1, {
                logger: (info) => {
                    if (info.status === 'recognizing text') {
                        this.updateProgress(info.progress * 50, 'מזהה טקסט...');
                    }
                    this.log(`Tesseract: ${info.status} - ${info.progress}`, 'debug');
                }
            });

            // הגדרות מתקדמות לשיפור OCR לקבצי PDF סרוקים
            await this.configureTesseractParameters();
            
            // אתחול מודול עיבוד התמונה
            this.imageProcessor = new ImageProcessor();
            this.imageProcessor.setDebugMode(window.DEBUG_MODE || false);
            
            this.log('Tesseract worker and image processor initialized successfully');
            
        } catch (error) {
            this.log(`Failed to initialize Tesseract: ${error.message}`, 'error');
            this.showError('שגיאה באתחול מנוע OCR');
        }
    }

    // הגדרת פרמטרים מתקדמים ל-Tesseract עם בחירה דינמית
    async configureTesseractParameters() {
        try {
            this.log('Configuring advanced Tesseract parameters...');
            
            // הגדרות בסיסיות לשיפור OCR לקבצי PDF סרוקים
            const baseParams = {
                // מנוע OCR מתקדם
                'tessedit_ocr_engine_mode': '1',  // LSTM engine
                
                // הגדרות לשיפור דיוק כללי
                'classify_enable_learning': '1',
                'classify_enable_adaptive_matcher': '1',
                'use_new_state_cost': '1',
                
                // הגדרות לטבלאות ומספרים
                'numeric_punctuation': '.,₪$€£',
                'preserve_interword_spaces': '1',
                
                // הגדרות DPI ואיכות
                'user_defined_dpi': '300',
                'min_orientation_margin': '7',
                
                // הגדרות לטקסט עברי
                'textord_heavy_nr': '1',
                'textord_debug_tabfind': '0',
                
                // הגדרות לזיהוי תווים
                'tessedit_char_blacklist': '',
                'tessedit_write_images': '0',
                
                // הגדרות מתקדמות לשיפור דיוק
                'enable_new_segsearch': '1',
                'language_model_ngram_on': '1',
                'segment_penalty_dict_frequent_word': '1',
                'segment_penalty_dict_case_ok': '1',
                'segment_penalty_dict_case_bad': '1.3125',
                
                // הגדרות לטיפול ברעש
                'textord_noise_area_ratio': '0.7',
                'textord_noise_sizelimit': '0.5',
                'textord_noise_translimit': '16',
                
                // הגדרות לזיהוי מילים
                'segment_penalty_dict_nonword': '1.25',
                'stopper_nondict_certainty_base': '-2.50',
                'wordrec_max_join_chunks': '4'
            };

            await this.tesseractWorker.setParameters(baseParams);
            this.log('Base Tesseract parameters configured successfully');
            
        } catch (error) {
            this.log(`Failed to configure Tesseract parameters: ${error.message}`, 'warn');
        }
    }

    // בחירה דינמית של PSM על בסיס סוג התוכן
    async setDynamicPSM(contentType, canvas) {
        try {
            let psmMode = '6'; // ברירת מחדל
            let whitelist = 'אבגדהוזחטיכלמנסעפצקרשת0123456789.,()-+=₪$€£ ';
            
            switch (contentType) {
                case 'table':
                    // מצב טבלה - זיהוי בלוקים אחידים
                    psmMode = '6'; // Uniform block of text
                    whitelist = 'אבגדהוזחטיכלמנסעפצקרשת0123456789.,()-+=₪$€£% ';
                    break;
                    
                case 'hebrew_text':
                    // טקסט עברי - זיהוי אוטומטי מלא
                    psmMode = '3'; // Fully automatic page segmentation
                    whitelist = 'אבגדהוזחטיכלמנסעפצקרשתABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,()-+=₪$€£ ';
                    break;
                    
                case 'mixed':
                    // תוכן מעורב - זיהוי עם OSD
                    psmMode = '1'; // Automatic page segmentation with OSD
                    whitelist = 'אבגדהוזחטיכלמנסעפצקרשתABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,()-+=₪$€£% ';
                    break;
                    
                case 'fallback':
                    // מצב חלופה - פשוט ויציב
                    psmMode = '8'; // Single word
                    whitelist = 'אבגדהוזחטיכלמנסעפצקרשת0123456789.,()-+=₪$€£ ';
                    break;
            }

            // אופטימיזציה נוספת על בסיס ניתוח התמונה
            const imageAnalysis = this.analyzeImageCharacteristics(canvas);
            
            if (imageAnalysis.hasStrongLines) {
                psmMode = '6'; // טוב יותר לטבלאות עם קווים ברורים
            }
            
            if (imageAnalysis.textDensity < 0.1) {
                psmMode = '8'; // טקסט דליל - מילה אחת בכל פעם
            }

            await this.tesseractWorker.setParameters({
                'tessedit_pageseg_mode': psmMode,
                'tessedit_char_whitelist': whitelist
            });

            this.log(`PSM set to ${psmMode} for ${contentType} content`);
            
        } catch (error) {
            this.log(`Failed to set dynamic PSM: ${error.message}`, 'warn');
        }
    }

    // ניתוח מאפייני תמונה
    analyzeImageCharacteristics(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let blackPixels = 0;
        let horizontalLines = 0;
        let verticalLines = 0;
        
        // סריקה לזיהוי מאפיינים
        for (let y = 0; y < canvas.height; y++) {
            let consecutiveBlack = 0;
            
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                
                if (gray < 128) {
                    blackPixels++;
                    consecutiveBlack++;
                } else {
                    if (consecutiveBlack > canvas.width * 0.3) {
                        horizontalLines++;
                    }
                    consecutiveBlack = 0;
                }
            }
        }
        
        // בדיקת קווים אנכיים
        for (let x = 0; x < canvas.width; x++) {
            let consecutiveBlack = 0;
            
            for (let y = 0; y < canvas.height; y++) {
                const idx = (y * canvas.width + x) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                
                if (gray < 128) {
                    consecutiveBlack++;
                } else {
                    if (consecutiveBlack > canvas.height * 0.2) {
                        verticalLines++;
                    }
                    consecutiveBlack = 0;
                }
            }
        }
        
        const totalPixels = canvas.width * canvas.height;
        const textDensity = blackPixels / totalPixels;
        const hasStrongLines = horizontalLines > 3 || verticalLines > 2;
        
        this.log(`Image analysis: density=${textDensity.toFixed(3)}, h-lines=${horizontalLines}, v-lines=${verticalLines}`);
        
        return {
            textDensity,
            hasStrongLines,
            horizontalLines,
            verticalLines
        };
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

                // טקסט חלקי - נסה שילוב עם OCR
                this.log('Using hybrid approach (text + OCR)');
                
                const directStartTime = Date.now();
                const directData = this.extractTableFromText(textContent);
                const directTime = Date.now() - directStartTime;
                
                const ocrStartTime = Date.now();
                const ocrData = await this.extractTableFromOCR(page);
                const ocrTime = Date.now() - ocrStartTime;
                
                pageMetrics.methods.push({
                    type: 'direct_extraction',
                    time: directTime,
                    rows: directData.length
                });
                
                pageMetrics.methods.push({
                    type: 'ocr_extraction',
                    time: ocrTime,
                    rows: ocrData.length
                });
                
                const result = this.mergeTextResults(directData, ocrData);
                pageMetrics.finalResult = { method: 'hybrid', rows: result.length };
                return result;
                
            } else {
                // טקסט גרוע או לא קיים - עבור ל-OCR בלבד
                this.log('Falling back to OCR-only approach');
                
                const ocrStartTime = Date.now();
                const result = await this.extractTableFromOCR(page);
                const ocrTime = Date.now() - ocrStartTime;
                
                pageMetrics.methods.push({
                    type: 'ocr_only',
                    time: ocrTime,
                    rows: result.length
                });
                
                pageMetrics.finalResult = { method: 'ocr_only', rows: result.length };
                return result;
            }
            
        } catch (error) {
            this.log(`Error processing page: ${error.message}`, 'error');
            
            // ניסיון OCR כחלופה סופית
            const fallbackStartTime = Date.now();
            const result = await this.extractTableFromOCR(page);
            const fallbackTime = Date.now() - fallbackStartTime;
            
            pageMetrics.methods.push({
                type: 'fallback_ocr',
                time: fallbackTime,
                rows: result.length,
                error: error.message
            });
            
            pageMetrics.finalResult = { method: 'fallback_ocr', rows: result.length };
            return result;
            
        } finally {
            pageMetrics.totalTime = Date.now() - startTime;
            this.logPageMetrics(pageMetrics);
        }
    }

    // תיעוד מטריקות עמוד
    logPageMetrics(metrics) {
        const summary = {
            totalTime: metrics.totalTime,
            finalMethod: metrics.finalResult?.method,
            finalRows: metrics.finalResult?.rows,
            methodsUsed: metrics.methods.length,
            breakdown: metrics.methods.map(m => ({
                type: m.type,
                time: m.time,
                performance: m.rows ? `${m.rows} rows` : 'failed'
            }))
        };
        
        this.log('Page processing metrics:', summary);
        
        // שמירת מטריקות למעקב ביצועים
        if (!window.PDFProcessingMetrics) {
            window.PDFProcessingMetrics = [];
        }
        window.PDFProcessingMetrics.push(summary);
    }

    // השתמש בפונקציה החדשה במקום הישנה
    async processPage(page) {
        // האם להשתמש במדידת ביצועים?
        if (window.DEBUG_MODE || this.enableMetrics) {
            return await this.processPageWithMetrics(page);
        } else {
            // גרסה מהירה ללא מטריקות
            return await this.processPageStandard(page);
        }
    }

    // הפונקציה הסטנדרטית ללא מטריקות
    async processPageStandard(page) {
        try {
            this.log('Processing page - attempting text extraction first');
            
            // ניסיון חילוץ טקסט ישירות מה-PDF
            const textContent = await page.getTextContent();
            
            // בדיקת איכות הטקסט הישיר
            const directTextQuality = this.assessTextQuality(textContent);
            this.log(`Direct text quality score: ${directTextQuality.score}`);
            
            if (directTextQuality.score > 0.7) {
                // טקסט איכותי - השתמש בו ישירות
                this.log('Using direct text extraction');
                return this.extractTableFromText(textContent);
            } else if (directTextQuality.score > 0.3) {
                // טקסט חלקי - נסה שילוב עם OCR
                this.log('Using hybrid approach (text + OCR)');
                const directData = this.extractTableFromText(textContent);
                const ocrData = await this.extractTableFromOCR(page);
                return this.mergeTextResults(directData, ocrData);
            } else {
                // טקסט גרוע או לא קיים - עבור ל-OCR בלבד
                this.log('Falling back to OCR-only approach');
                return await this.extractTableFromOCR(page);
            }
            
        } catch (error) {
            this.log(`Error processing page: ${error.message}`, 'error');
            // ניסיון OCR כחלופה סופית
            return await this.extractTableFromOCR(page);
        }
    }

    // הערכת איכות טקסט ישיר מ-PDF
    assessTextQuality(textContent) {
        const items = textContent.items;
        
        if (!items || items.length === 0) {
            return { score: 0, reason: 'No text content' };
        }

        let totalText = '';
        let hebrewChars = 0;
        let englishChars = 0;
        let numberChars = 0;
        let specialChars = 0;
        let readableWords = 0;

        // ניתוח תכולת הטקסט
        items.forEach(item => {
            const text = item.str || '';
            totalText += text + ' ';
            
            for (const char of text) {
                if (/[\u0590-\u05FF]/.test(char)) {
                    hebrewChars++;
                } else if (/[a-zA-Z]/.test(char)) {
                    englishChars++;
                } else if (/\d/.test(char)) {
                    numberChars++;
                } else if (/[₪$€£,.\-()]/.test(char)) {
                    specialChars++;
                }
            }
        });

        // ספירת מילים קריאות
        const words = totalText.trim().split(/\s+/);
        readableWords = words.filter(word => 
            word.length > 1 && !/^[^\w\u0590-\u05FF]+$/.test(word)
        ).length;

        // חישוב ציון איכות
        const totalChars = hebrewChars + englishChars + numberChars + specialChars;
        let score = 0;

        if (totalChars > 0) {
            // ציון בסיסי על בסיס תוכן משמעותי
            score += Math.min(readableWords / 10, 0.4);
            
            // בונוס עבור תוכן עברי
            if (hebrewChars > 0) {
                score += Math.min(hebrewChars / totalChars, 0.3);
            }
            
            // בונוס עבור מספרים (דוחות כספיים)
            if (numberChars > 0) {
                score += Math.min(numberChars / totalChars * 2, 0.2);
            }
            
            // בונוס עבור תווים מיוחדים של כסף
            if (specialChars > 0) {
                score += Math.min(specialChars / totalChars * 3, 0.1);
            }
        }

        return {
            score: Math.min(score, 1.0),
            reason: `${readableWords} words, ${hebrewChars} Hebrew chars, ${numberChars} numbers`,
            details: { hebrewChars, englishChars, numberChars, specialChars, readableWords }
        };
    }

    // מיזוג תוצאות טקסט ישיר עם OCR
    mergeTextResults(directData, ocrData) {
        this.log(`Merging results: ${directData.length} direct rows, ${ocrData.length} OCR rows`);
        
        if (directData.length === 0) return ocrData;
        if (ocrData.length === 0) return directData;
        
        // בחירת התוצאה הטובה יותר על בסיס כמות ואיכות
        const directScore = this.scoreTableData(directData);
        const ocrScore = this.scoreTableData(ocrData);
        
        this.log(`Table scores - Direct: ${directScore}, OCR: ${ocrScore}`);
        
        if (directScore > ocrScore * 1.2) {
            return directData;
        } else if (ocrScore > directScore * 1.2) {
            return ocrData;
        } else {
            // ציונים דומים - נסה לשלב
            return this.combineTableData(directData, ocrData);
        }
    }

    // ניקוד נתוני טבלה
    scoreTableData(tableData) {
        if (!tableData || tableData.length === 0) return 0;
        
        let score = 0;
        
        // ציון בסיסי על מספר שורות
        score += Math.min(tableData.length / 10, 0.3);
        
        // ציון על עקביות מספר עמודות
        const columnCounts = tableData.map(row => row.length);
        const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
        const columnConsistency = 1 - (Math.max(...columnCounts) - Math.min(...columnCounts)) / (avgColumns || 1);
        score += columnConsistency * 0.3;
        
        // ציון על תוכן משמעותי
        let meaningfulCells = 0;
        let totalCells = 0;
        
        tableData.forEach(row => {
            row.forEach(cell => {
                totalCells++;
                if (cell && cell.trim().length > 1) {
                    meaningfulCells++;
                    
                    // בונוס עבור מספרים ועברית
                    if (/\d/.test(cell)) meaningfulCells += 0.5;
                    if (/[\u0590-\u05FF]/.test(cell)) meaningfulCells += 0.3;
                }
            });
        });
        
        const contentRatio = totalCells > 0 ? meaningfulCells / totalCells : 0;
        score += contentRatio * 0.4;
        
        return Math.min(score, 1.0);
    }

    // שילוב נתוני טבלה
    combineTableData(directData, ocrData) {
        this.log('Attempting to combine direct and OCR data');
        
        // אסטרטגיה פשוטה - בחירה בנתונים עם יותר עמודות בממוצע
        const directAvgCols = this.getAverageColumns(directData);
        const ocrAvgCols = this.getAverageColumns(ocrData);
        
        if (directAvgCols > ocrAvgCols) {
            return directData;
        } else {
            return ocrData;
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

    // חילוץ טבלה באמצעות OCR מתקדם
    async extractTableFromOCR(page) {
        if (!this.tesseractWorker) {
            throw new Error('OCR worker not initialized');
        }

        this.log('Starting advanced OCR extraction');

        // רינדור עמוד לcanvas עם רזולוציה גבוהה יותר
        const baseScale = 2.5; // הגדלת הרזולוציה הבסיסית
        const viewport = page.getViewport({ scale: baseScale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // רינדור עם הגדרות איכות מתקדמות
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        this.log(`Canvas rendered: ${canvas.width}x${canvas.height}`);

        // עיבוד מקדים של התמונה
        let processedCanvas = canvas;
        
        if (this.imageProcessor) {
            try {
                // זיהוי סוג התוכן לבחירת אסטרטגיית עיבוד
                // זיהוי סוג התוכן לבחירת אסטרטגיית עיבוד מיטבית
                const contentAnalysis = this.detectContentType(canvas);
                const processingStrategy = contentAnalysis.type;
                this.log(`Detected content: ${processingStrategy} (confidence: ${contentAnalysis.confidence.toFixed(3)})`);

                switch (processingStrategy) {
                    case 'table':
                        // עיבוד מיוחד לטבלאות עם התאמה לרמת ביטחון
                        processedCanvas = this.imageProcessor.preprocessTable(canvas);
                        processedCanvas = this.imageProcessor.enhanceForOCR(processedCanvas, {
                            scale: contentAnalysis.confidence > 0.7 ? 1.0 : 1.2, // פחות scale אם יש ביטחון גבוה
                            noiseReduction: true,
                            contrastEnhancement: true,
                            binaryThreshold: true,
                            sharpen: contentAnalysis.confidence > 0.5 // חידוד רק אם יש ביטחון
                        });
                        break;
                        
                    case 'hebrew_text':
                        // עיבוד מיוחד לטקסט עברי
                        processedCanvas = this.imageProcessor.optimizeForHebrew(canvas);
                        processedCanvas = this.imageProcessor.enhanceForOCR(processedCanvas, {
                            scale: 1.3,
                            noiseReduction: contentAnalysis.confidence < 0.5, // רעש רק אם ביטחון נמוך
                            contrastEnhancement: true,
                            binaryThreshold: true,
                            sharpen: false // פחות חידוד לטקסט עברי
                        });
                        break;
                        
                    default:
                        // עיבוד כללי מותאם לביטחון
                        processedCanvas = this.imageProcessor.enhanceForOCR(processedCanvas, {
                            scale: contentAnalysis.confidence > 0.6 ? 1.2 : 1.5,
                            noiseReduction: true,
                            contrastEnhancement: true,
                            binaryThreshold: true,
                            sharpen: contentAnalysis.confidence > 0.4
                        });
                }
                
                this.log('Image preprocessing completed');
                
            } catch (error) {
                this.log(`Image preprocessing failed: ${error.message}`, 'warn');
                // ממשיך עם הcanvas המקורי
                processedCanvas = canvas;
            }
        }

        // קבלת הגדרות שפת OCR
        const ocrLanguage = document.getElementById('ocrLanguage')?.value || 'heb+eng';
        
        // הגדרות OCR דינמיות על בסיס התוכן
        await this.setDynamicPSM(processingStrategy, processedCanvas);
        
        this.log(`Starting OCR with language: ${ocrLanguage}, strategy: ${processingStrategy}`);

        // ביצוע OCR עם הגדרות מתקדמות
        const { data: { text, confidence } } = await this.tesseractWorker.recognize(processedCanvas, {
            lang: ocrLanguage
        });

        this.log(`OCR completed with confidence: ${confidence}`);

        // בדיקת איכות התוצאה ונסיונות נוספים אם נדרש
        if (confidence < 30) {
            this.log('Low OCR confidence, attempting multi-pass strategy', 'warn');
            return await this.multiPassOCR(canvas, processedCanvas, ocrLanguage, processingStrategy);
        }

        // ניתוח הטקסט שזוהה
        return this.parseOCRText(text, processingStrategy);
    }

    // OCR מרובה מעברים לשיפור דיוק
    async multiPassOCR(originalCanvas, processedCanvas, language, contentType) {
        this.log('Starting multi-pass OCR strategy');
        
        const attempts = [];
        
        try {
            // מעבר 1: עם העיבוד הנוכחי
            const pass1 = await this.singlePassOCR(processedCanvas, language, contentType, 'enhanced');
            attempts.push({ type: 'enhanced', ...pass1 });
            
            // מעבר 2: עם עיבוד חלופי
            let alternativeCanvas = originalCanvas;
            if (this.imageProcessor) {
                alternativeCanvas = this.imageProcessor.enhanceForOCR(originalCanvas, {
                    scale: 2.0,           // scale שונה
                    noiseReduction: false, // פחות עיבוד
                    contrastEnhancement: true,
                    binaryThreshold: true,
                    sharpen: false        // בלי חידוד
                });
            }
            
            await this.setDynamicPSM('fallback', alternativeCanvas); // PSM שמרני יותר
            const pass2 = await this.singlePassOCR(alternativeCanvas, language, 'fallback', 'conservative');
            attempts.push({ type: 'conservative', ...pass2 });
            
            // מעבר 3: מנוע OCR ישן (Legacy)
            await this.tesseractWorker.setParameters({
                'tessedit_ocr_engine_mode': '0', // Legacy engine
                'tessedit_pageseg_mode': '6'     // PSM בסיסי
            });
            
            const pass3 = await this.singlePassOCR(originalCanvas, language, 'mixed', 'legacy');
            attempts.push({ type: 'legacy', ...pass3 });
            
            // מעבר 4: עם scale גבוה מאוד
            let highScaleCanvas = originalCanvas;
            if (this.imageProcessor) {
                highScaleCanvas = this.imageProcessor.enhanceForOCR(originalCanvas, {
                    scale: 4.0,           // scale מאוד גבוה
                    noiseReduction: true,
                    contrastEnhancement: true,
                    binaryThreshold: true,
                    sharpen: true
                });
            }
            
            await this.setDynamicPSM(contentType, highScaleCanvas); // חזרה להגדרות מקוריות
            const pass4 = await this.singlePassOCR(highScaleCanvas, language, contentType, 'high_scale');
            attempts.push({ type: 'high_scale', ...pass4 });
            
        } catch (error) {
            this.log(`Multi-pass OCR error: ${error.message}`, 'error');
        }
        
        // בחירת התוצאה הטובה ביותר
        const bestResult = this.selectBestOCRResult(attempts);
        this.log(`Selected best result from ${attempts.length} attempts: ${bestResult.type} (confidence: ${bestResult.confidence})`);
        
        return bestResult.data;
    }

    // ביצוע OCR יחיד עם מדידת ביצועים
    async singlePassOCR(canvas, language, contentType, passType) {
        const startTime = Date.now();
        
        try {
            const { data: { text, confidence } } = await this.tesseractWorker.recognize(canvas, {
                lang: language
            });
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            const parsedData = this.parseOCRText(text, contentType);
            const dataScore = this.scoreTableData(parsedData);
            
            this.log(`${passType} pass: confidence=${confidence}, data_score=${dataScore.toFixed(3)}, time=${processingTime}ms`);
            
            return {
                text,
                confidence,
                data: parsedData,
                dataScore,
                processingTime,
                textLength: text.length
            };
            
        } catch (error) {
            this.log(`Single pass OCR error (${passType}): ${error.message}`, 'error');
            return {
                text: '',
                confidence: 0,
                data: [],
                dataScore: 0,
                processingTime: 0,
                textLength: 0
            };
        }
    }

    // בחירת התוצאה הטובה ביותר ממספר נסיונות
    selectBestOCRResult(attempts) {
        if (attempts.length === 0) {
            return { data: [], confidence: 0, type: 'none' };
        }
        
        // ניקוד כל נסיון על בסיס מספר קריטריונים
        const scoredAttempts = attempts.map(attempt => {
            let score = 0;
            
            // ציון confidence (משקל 40%)
            score += (attempt.confidence / 100) * 0.4;
            
            // ציון איכות נתונים (משקל 35%)
            score += attempt.dataScore * 0.35;
            
            // ציון אורך טקסט - יותר טקסט = טוב יותר (משקל 15%)
            const textLengthScore = Math.min(attempt.textLength / 500, 1.0);
            score += textLengthScore * 0.15;
            
            // ציון זמן עיבוד - מהר יותר = טוב יותר (משקל 10%)
            const timeScore = Math.max(0, 1 - (attempt.processingTime / 30000)); // 30 שניות max
            score += timeScore * 0.1;
            
            // בונוס למספר שורות נתונים
            if (attempt.data.length > 5) {
                score += 0.1;
            }
            
            return {
                ...attempt,
                finalScore: score
            };
        });
        
        // מיון לפי ציון סופי
        scoredAttempts.sort((a, b) => b.finalScore - a.finalScore);
        
        this.log('OCR attempts scoring:', scoredAttempts.map(a => 
            `${a.type}: ${a.finalScore.toFixed(3)} (conf:${a.confidence}, data:${a.dataScore.toFixed(3)})`
        ).join(', '));
        
        return scoredAttempts[0];
    }
    }

    // זיהוי סוג התוכן בעמוד מתקדם
    detectContentType(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // סטטיסטיקות מפורטות
        let blackPixels = 0;
        let horizontalLinePixels = 0;
        let verticalLinePixels = 0;
        let textBlocks = 0;
        let whiteSpaceBlocks = 0;
        
        // סריקה מפורטת לזיהוי תבניות
        for (let y = 0; y < canvas.height - 1; y++) {
            let consecutiveBlackH = 0;
            let consecutiveWhiteH = 0;
            
            for (let x = 0; x < canvas.width - 1; x++) {
                const idx = (y * canvas.width + x) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                const isBlack = gray < 128;
                
                if (isBlack) {
                    blackPixels++;
                    consecutiveBlackH++;
                    consecutiveWhiteH = 0;
                    
                    // בדיקת קו אופקי
                    if (consecutiveBlackH > canvas.width * 0.15) {
                        horizontalLinePixels++;
                    }
                } else {
                    if (consecutiveBlackH > 0 && consecutiveBlackH < canvas.width * 0.1) {
                        textBlocks++;
                    }
                    consecutiveBlackH = 0;
                    consecutiveWhiteH++;
                    
                    if (consecutiveWhiteH > canvas.width * 0.1) {
                        whiteSpaceBlocks++;
                    }
                }
            }
        }
        
        // בדיקת קווים אנכיים
        for (let x = 0; x < canvas.width - 1; x++) {
            let consecutiveBlackV = 0;
            
            for (let y = 0; y < canvas.height - 1; y++) {
                const idx = (y * canvas.width + x) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                
                if (gray < 128) {
                    consecutiveBlackV++;
                } else {
                    if (consecutiveBlackV > canvas.height * 0.1) {
                        verticalLinePixels++;
                    }
                    consecutiveBlackV = 0;
                }
            }
        }
        
        // חישוב מדדים מנורמלים
        const totalPixels = canvas.width * canvas.height;
        const textDensity = blackPixels / totalPixels;
        const horizontalLineRatio = horizontalLinePixels / totalPixels;
        const verticalLineRatio = verticalLinePixels / totalPixels;
        const textBlockRatio = textBlocks / (canvas.width * canvas.height / 100);
        const structuredContentRatio = (horizontalLinePixels + verticalLinePixels) / blackPixels;
        
        // החלטה על סוג התוכן על בסיס מדדים מרובים
        let contentType = 'mixed';
        let confidence = 0;
        
        // זיהוי טבלה
        if ((horizontalLineRatio > 0.001 && verticalLineRatio > 0.0005) || structuredContentRatio > 0.3) {
            contentType = 'table';
            confidence = Math.min((horizontalLineRatio + verticalLineRatio) * 1000, 1.0);
        }
        // זיהוי טקסט עברי רגיל
        else if (textDensity > 0.05 && textDensity < 0.25 && textBlockRatio > 2) {
            contentType = 'hebrew_text';
            confidence = Math.min(textBlockRatio / 10, 1.0);
        }
        // תוכן דליל או מעורב
        else if (textDensity < 0.02) {
            contentType = 'mixed';
            confidence = 0.3;
        }
        
        this.log(`Content analysis: type=${contentType} (conf: ${confidence.toFixed(3)}) - density=${textDensity.toFixed(4)}, h-lines=${horizontalLineRatio.toFixed(4)}, v-lines=${verticalLineRatio.toFixed(4)}, blocks=${textBlockRatio.toFixed(2)}`);
        
        return {
            type: contentType,
            confidence: confidence,
            metrics: {
                textDensity,
                horizontalLineRatio,
                verticalLineRatio,
                textBlockRatio,
                structuredContentRatio
            }
        };
    }

    // קבלת אפשרויות OCR על בסיס סוג התוכן
    getOCROptions(contentType) {
        const baseOptions = {};
        
        switch (contentType) {
            case 'table':
                return {
                    ...baseOptions,
                    tessedit_pageseg_mode: '6', // Uniform block
                    preserve_interword_spaces: '1'
                };
                
            case 'hebrew_text':
                return {
                    ...baseOptions,
                    tessedit_pageseg_mode: '3', // Fully automatic
                    textord_heavy_nr: '1'
                };
                
            default:
                return {
                    ...baseOptions,
                    tessedit_pageseg_mode: '1' // Automatic with OSD
                };
        }
    }

    // אסטרטגיית חלופה ל-OCR
    async fallbackOCRStrategy(canvas, language) {
        this.log('Attempting fallback OCR strategy');
        
        try {
            // ניסיון עם הגדרות שמרניות יותר
            const { data: { text } } = await this.tesseractWorker.recognize(canvas, {
                lang: language,
                tessedit_pageseg_mode: '6', // מצב יותר בסיסי
                tessedit_ocr_engine_mode: '0' // Legacy engine
            });
            
            return this.parseOCRText(text, 'fallback');
            
        } catch (error) {
            this.log(`Fallback OCR also failed: ${error.message}`, 'error');
            return []; // החזרת מערך ריק
        }
    }

    // ניתוח טקסט OCR לפורמט טבלה מתקדם
    parseOCRText(text, contentType = 'mixed') {
        if (!text || text.trim().length === 0) {
            this.log('No text received from OCR', 'warn');
            return [];
        }

        this.log(`Parsing OCR text (${contentType}): ${text.length} characters`);

        // ניקוי ראשוני של הטקסט
        let cleanedText = this.cleanOCRText(text);
        
        // פיצול לשורות
        const lines = cleanedText.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            this.log('No valid lines found after cleaning', 'warn');
            return [];
        }

        this.log(`Found ${lines.length} text lines`);

        let tableData = [];

        // אסטרטגיות ניתוח שונות לפי סוג התוכן
        switch (contentType) {
            case 'table':
                tableData = this.parseTableStructure(lines);
                break;
                
            case 'hebrew_text':
                tableData = this.parseHebrewText(lines);
                break;
                
            case 'fallback':
                tableData = this.parseBasicStructure(lines);
                break;
                
            default:
                tableData = this.parseAdvancedStructure(lines);
        }

        // נרמול וניקוי סופי
        tableData = this.normalizeTable(tableData);
        tableData = this.validateTableStructure(tableData);

        this.log(`Parsed ${tableData.length} rows with average ${this.getAverageColumns(tableData)} columns`);
        
        return tableData;
    }

    // ניקוי טקסט OCR
    cleanOCRText(text) {
        return text
            // הסרת תווים מיוחדים לא רצויים
            .replace(/[|│║▌▐█]/g, ' ') // תווי קו אנכי
            .replace(/[─━═]/g, ' ')     // תווי קו אופקי
            .replace(/[┌┐└┘├┤┬┴┼]/g, ' ') // תווי פינות טבלה
            .replace(/[•◦▪▫]/g, ' ')   // תווי רשימה
            .replace(/\s{3,}/g, '\t')  // המרת רווחים מרובים לטאב
            .replace(/\t+/g, '\t')     // איחוד טאבים
            .replace(/[ \t]+$/gm, '')  // הסרת רווחים בסוף שורות
            .replace(/^[ \t]+/gm, '')  // הסרת רווחים בתחילת שורות
            .trim();
    }

    // ניתוח מבנה טבלה
    parseTableStructure(lines) {
        const tableData = [];
        
        for (const line of lines) {
            // זיהוי שורות טבלה לפי תבניות
            if (this.isTableRow(line)) {
                const cells = this.extractTableCells(line);
                if (cells.length > 0) {
                    tableData.push(cells);
                }
            }
        }
        
        return tableData;
    }

    // בדיקה האם שורה היא שורת טבלה
    isTableRow(line) {
        // בדיקות שונות לזיהוי שורת טבלה
        const hasNumbers = /\d/.test(line);
        const hasMultipleWords = line.trim().split(/\s+/).length > 1;
        const hasTabsOrSpaces = /\t|\s{2,}/.test(line);
        const hasSpecialChars = /[₪$€£,.-]/.test(line);
        
        return hasMultipleWords && (hasTabsOrSpaces || hasNumbers || hasSpecialChars);
    }

    // חילוץ תאי טבלה מתוך שורה
    extractTableCells(line) {
        // ניסיון פיצול לפי טאבים קודם
        let cells = line.split('\t').filter(cell => cell.trim());
        
        if (cells.length < 2) {
            // פיצול לפי רווחים מרובים
            cells = line.split(/\s{2,}/).filter(cell => cell.trim());
        }
        
        if (cells.length < 2) {
            // ניסיון פיצול חכם יותר עבור טקסט עברי
            cells = this.smartSplitHebrewLine(line);
        }
        
        return cells.map(cell => cell.trim()).filter(cell => cell.length > 0);
    }

    // פיצול חכם לשורות עברית
    smartSplitHebrewLine(line) {
        const cells = [];
        const words = line.trim().split(/\s+/);
        
        if (words.length <= 1) {
            return words;
        }
        
        // קיבוץ מילים לתאים על בסיס תבניות
        let currentCell = '';
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            // בדיקה אם המילה מתחילה תא חדש
            if (this.isNewCellIndicator(word, currentCell)) {
                if (currentCell.trim()) {
                    cells.push(currentCell.trim());
                }
                currentCell = word;
            } else {
                currentCell += (currentCell ? ' ' : '') + word;
            }
        }
        
        // הוספת התא האחרון
        if (currentCell.trim()) {
            cells.push(currentCell.trim());
        }
        
        return cells;
    }

    // בדיקה האם מילה מציינת תא חדש
    isNewCellIndicator(word, currentCell) {
        // מספר בתחילת מילה
        if (/^\d/.test(word) && currentCell.trim()) {
            return true;
        }
        
        // סכום כסף (₪, $, וכו')
        if (/[₪$€£]/.test(word)) {
            return true;
        }
        
        // תאריך
        if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(word)) {
            return true;
        }
        
        return false;
    }

    // ניתוח טקסט עברי
    parseHebrewText(lines) {
        const tableData = [];
        
        for (const line of lines) {
            // עיבוד מיוחד לטקסט עברי
            const cells = this.parseHebrewLine(line);
            if (cells.length > 0) {
                tableData.push(cells);
            }
        }
        
        return tableData;
    }

    // ניתוח שורה עברית
    parseHebrewLine(line) {
        // טיפול מיוחד בכיוון RTL
        const cleaned = line.trim();
        
        if (!cleaned) return [];
        
        // פיצול בסיסי
        const parts = cleaned.split(/\s{2,}|\t/).filter(part => part.trim());
        
        if (parts.length > 1) {
            return parts.map(part => part.trim());
        } else {
            // אם אין הפרדה ברורה, מחזיר כתא יחיד
            return [cleaned];
        }
    }

    // ניתוח מבנה בסיסי (fallback)
    parseBasicStructure(lines) {
        const tableData = [];
        
        for (const line of lines) {
            const cells = line.split(/\s{2,}|\t/).filter(cell => cell.trim());
            if (cells.length > 0) {
                tableData.push(cells.map(cell => cell.trim()));
            }
        }
        
        return tableData;
    }

    // ניתוח מבנה מתקדם
    parseAdvancedStructure(lines) {
        // שילוב של כל האסטרטגיות
        let tableData = [];
        
        // ניסיון ראשון - זיהוי טבלאות
        const tableLines = lines.filter(line => this.isTableRow(line));
        
        if (tableLines.length > lines.length * 0.5) {
            // רוב השורות נראות כמו טבלה
            tableData = this.parseTableStructure(lines);
        } else {
            // טקסט חופשי יותר
            tableData = this.parseHebrewText(lines);
        }
        
        return tableData;
    }

    // אימות מבנה טבלה
    validateTableStructure(tableData) {
        if (tableData.length === 0) return tableData;
        
        // הסרת שורות ריקות לחלוטין
        tableData = tableData.filter(row => 
            row.some(cell => cell && cell.trim().length > 0)
        );
        
        // אימות שיש לפחות עמודה אחת עם תוכן משמעותי
        const hasContent = tableData.some(row => 
            row.some(cell => cell && cell.trim().length > 2)
        );
        
        if (!hasContent) {
            this.log('Table structure validation failed - no meaningful content', 'warn');
            return [];
        }
        
        return tableData;
    }

    // חישוב ממוצע עמודות
    getAverageColumns(tableData) {
        if (tableData.length === 0) return 0;
        const totalColumns = tableData.reduce((sum, row) => sum + row.length, 0);
        return Math.round(totalColumns / tableData.length * 10) / 10;
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
    // ניקוי וטיפול בטקסט עברי מ-OCR
    cleanHebrewOCRText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        this.log('Cleaning Hebrew OCR text');

        let cleaned = text
            // תיקון תווים מעורבבים נפוצים ב-OCR עברי
            .replace(/[`'"״׳]/g, '"')           // תיקון מרכאות
            .replace(/[־–—]/g, '-')             // תיקון מקפים
            .replace(/[׀|]/g, '|')              // תיקון קווים אנכיים
            .replace(/[₪＄]/g, '₪')             // תיקון סימני שקל
            
            // תיקון תווים עבריים שנפסדו ב-OCR
            .replace(/[אא]/g, 'א')
            .replace(/[בב]/g, 'ב')
            .replace(/[גג]/g, 'ג')
            .replace(/[דד]/g, 'ד')
            .replace(/[הה]/g, 'ה')
            .replace(/[וו]/g, 'ו')
            .replace(/[זז]/g, 'ז')
            .replace(/[חח]/g, 'ח')
            .replace(/[טט]/g, 'ט')
            .replace(/[יי]/g, 'י')
            .replace(/[ככ]/g, 'כ')
            .replace(/[לל]/g, 'ל')
            .replace(/[ממ]/g, 'מ')
            .replace(/[ננ]/g, 'ן')
            .replace(/[סס]/g, 'ס')
            .replace(/[עע]/g, 'ע')
            .replace(/[פפ]/g, 'פ')
            .replace(/[צצ]/g, 'צ')
            .replace(/[קק]/g, 'ק')
            .replace(/[רר]/g, 'ר')
            .replace(/[שש]/g, 'ש')
            .replace(/[תת]/g, 'ת')
            
            // תיקון מספרים עם פסיקים (אלפים)
            .replace(/(\d),(\d)/g, '$1,$2')
            
            // תיקון מספרים בסוגריים (מספרים שליליים)
            .replace(/\(\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*\)/g, '($1)')
            
            // תיקון רווחים מיותרים בין מספרים
            .replace(/(\d)\s+(\d)/g, '$1$2')
            
            // תיקון רווחים סביב סימני פיסוק
            .replace(/\s*([,.])\s*/g, '$1')
            
            // הסרת רווחים מיותרים
            .replace(/\s+/g, ' ')
            .trim();

        this.log(`Text cleaned: ${text.length} -> ${cleaned.length} characters`);
        return cleaned;
    }

    // ניתוח מתקדם לטבלאות כספיות
    parseFinancialTable(ocrText) {
        this.log('Starting financial table parsing');
        
        if (!ocrText || ocrText.trim().length === 0) {
            return [];
        }

        // ניקוי הטקסט קודם
        const cleanedText = this.cleanHebrewOCRText(ocrText);
        const lines = cleanedText.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            return [];
        }

        // זיהוי מבנה הטבלה הכספית
        const tableStructure = this.analyzeFinancialTableStructure(lines);
        
        // חילוץ נתונים על בסיס המבנה שזוהה
        const extractedData = this.extractFinancialData(lines, tableStructure);
        
        // ניקוי ואימות הנתונים הכספיים
        const validatedData = this.validateFinancialData(extractedData);
        
        this.log(`Financial table parsed: ${validatedData.length} rows extracted`);
        return validatedData;
    }

    // ניתוח מבנה טבלה כספית
    analyzeFinancialTableStructure(lines) {
        const structure = {
            headerRowIndex: -1,
            columnTypes: [],
            hasAmountColumns: false,
            hasDateColumns: false,
            currencySymbol: '₪',
            isRTL: true,
            thousandsSeparator: ',',
            decimalSeparator: '.'
        };

        // חיפוש שורת כותרת
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i];
            
            // זיהוי שורת כותרת על בסיס מילות מפתח
            if (this.isFinancialHeaderRow(line)) {
                structure.headerRowIndex = i;
                break;
            }
        }

        // ניתוח עמודות בשורות הנתונים
        const dataLines = lines.slice(structure.headerRowIndex + 1, structure.headerRowIndex + 6);
        structure.columnTypes = this.analyzeColumnTypes(dataLines);
        
        // זיהוי עמודות סכומים
        structure.hasAmountColumns = structure.columnTypes.some(type => type === 'amount');
        
        // זיהוי עמודות תאריכים
        structure.hasDateColumns = structure.columnTypes.some(type => type === 'date');

        this.log('Financial table structure analyzed:', structure);
        return structure;
    }

    // בדיקה האם שורה היא שורת כותרת כספית
    isFinancialHeaderRow(line) {
        const financialKeywords = [
            'חשבון', 'תיאור', 'סכום', 'יתרה', 'זכות', 'חובה',
            'תאריך', 'מספר', 'פרטים', 'סה"כ', 'יתרות',
            'הכנסות', 'הוצאות', 'נכסים', 'התחייבויות', 'הון'
        ];

        const lowerLine = line.toLowerCase();
        let keywordCount = 0;
        
        for (const keyword of financialKeywords) {
            if (lowerLine.includes(keyword)) {
                keywordCount++;
            }
        }

        // אם יש לפחות 2 מילות מפתח כספיות, זוהי שורת כותרת
        return keywordCount >= 2;
    }

    // ניתוח סוגי עמודות
    analyzeColumnTypes(dataLines) {
        if (dataLines.length === 0) return [];
        
        // מציאת מספר העמודות המקסימלי
        const maxColumns = Math.max(...dataLines.map(line => 
            line.split(/\s{2,}|\t/).length
        ));

        const columnTypes = [];
        
        for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
            const columnSamples = dataLines
                .map(line => line.split(/\s{2,}|\t/)[colIndex])
                .filter(cell => cell && cell.trim());

            columnTypes.push(this.determineColumnType(columnSamples));
        }

        return columnTypes;
    }

    // קביעת סוג עמודה על בסיס דגימות
    determineColumnType(samples) {
        if (samples.length === 0) return 'text';

        let numericCount = 0;
        let dateCount = 0;
        let accountCount = 0;
        let amountCount = 0;

        for (const sample of samples) {
            const trimmed = sample.trim();
            
            // בדיקת סכום כסף
            if (this.isAmount(trimmed)) {
                amountCount++;
                numericCount++;
            }
            // בדיקת תאריך
            else if (this.isDate(trimmed)) {
                dateCount++;
            }
            // בדיקת מספר חשבון
            else if (this.isAccountNumber(trimmed)) {
                accountCount++;
            }
            // בדיקת מספר כללי
            else if (this.isNumeric(trimmed)) {
                numericCount++;
            }
        }

        const total = samples.length;
        
        // החלטה על סוג העמודה
        if (amountCount / total > 0.6) return 'amount';
        if (dateCount / total > 0.6) return 'date';
        if (accountCount / total > 0.6) return 'account';
        if (numericCount / total > 0.6) return 'numeric';
        
        return 'text';
    }

    // בדיקה האם מחרוזת היא סכום כסף
    isAmount(str) {
        // תבניות סכומי כסף נפוצות
        const amountPatterns = [
            /^₪?\s*\d{1,3}(,\d{3})*(\.\d{2})?$/,           // ₪1,234.56
            /^\d{1,3}(,\d{3})*(\.\d{2})?\s*₪?$/,           // 1,234.56₪
            /^\(\s*\d{1,3}(,\d{3})*(\.\d{2})?\s*\)$/,      // (1,234.56) - סכום שלילי
            /^-\s*\d{1,3}(,\d{3})*(\.\d{2})?$/             // -1,234.56
        ];

        return amountPatterns.some(pattern => pattern.test(str.trim()));
    }

    // בדיקה האם מחרוזת היא תאריך
    isDate(str) {
        const datePatterns = [
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,     // DD/MM/YYYY
            /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,     // DD.MM.YYYY
            /^\d{1,2}-\d{1,2}-\d{2,4}$/,       // DD-MM-YYYY
            /^\d{2,4}\/\d{1,2}\/\d{1,2}$/,     // YYYY/MM/DD
            /^\d{2,4}\.\d{1,2}\.\d{1,2}$/      // YYYY.MM.DD
        ];

        return datePatterns.some(pattern => pattern.test(str.trim()));
    }

    // בדיקה האם מחרוזת היא מספר חשבון
    isAccountNumber(str) {
        const trimmed = str.trim();
        
        // מספר חשבון ישראלי טיפוסי: 3-6 ספרות או מספר עם מקפים
        return /^\d{3,6}$/.test(trimmed) || 
               /^\d{1,3}-\d{1,3}-\d{1,3}$/.test(trimmed) ||
               /^\d{1,4}\.\d{1,4}$/.test(trimmed);
    }

    // בדיקה האם מחרוזת היא מספרית
    isNumeric(str) {
        const trimmed = str.trim();
        return /^\d+(\.\d+)?$/.test(trimmed) || 
               /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed);
    }

    // חילוץ נתונים כספיים על בסיס מבנה מזוהה
    extractFinancialData(lines, structure) {
        const extractedData = [];
        const startIndex = Math.max(0, structure.headerRowIndex + 1);
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line || this.isTableBorder(line)) {
                continue;
            }

            // פיצול השורה לתאים
            const cells = this.splitFinancialRow(line, structure);
            
            if (cells.length > 0) {
                // עיבוד כל תא על בסיס סוג העמודה
                const processedRow = this.processFinancialRow(cells, structure);
                extractedData.push(processedRow);
            }
        }

        return extractedData;
    }

    // פיצול שורה כספית לתאים
    splitFinancialRow(line, structure) {
        // ניסיון פיצול לפי טאבים או רווחים מרובים
        let cells = line.split(/\t|\s{3,}/).filter(cell => cell.trim());
        
        if (cells.length < 2) {
            // פיצול חכם יותר לדוחות כספיים עבריים
            cells = this.smartSplitFinancialLine(line);
        }

        return cells.map(cell => cell.trim()).filter(cell => cell.length > 0);
    }

    // פיצול חכם לשורה כספית עברית
    smartSplitFinancialLine(line) {
        const cells = [];
        const parts = line.trim().split(/\s+/);
        let currentCell = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // תחילת תא חדש: סכום כסף, תאריך, או מספר חשבון
            if (this.isNewFinancialCell(part, currentCell)) {
                if (currentCell.trim()) {
                    cells.push(currentCell.trim());
                }
                currentCell = part;
            } else {
                currentCell += (currentCell ? ' ' : '') + part;
            }
        }
        
        if (currentCell.trim()) {
            cells.push(currentCell.trim());
        }
        
        return cells;
    }

    // בדיקה האם חלק מציין תא כספי חדש
    isNewFinancialCell(part, currentCell) {
        if (!currentCell.trim()) return false;
        
        // תחילת סכום כסף
        if (this.isAmount(part) || part.startsWith('₪') || part.startsWith('(')) {
            return true;
        }
        
        // תחילת תאריך
        if (this.isDate(part)) {
            return true;
        }
        
        // תחילת מספר חשבון
        if (this.isAccountNumber(part) && !this.isAccountNumber(currentCell)) {
            return true;
        }
        
        return false;
    }

    // עיבוד שורה כספית
    processFinancialRow(cells, structure) {
        const processedRow = [];
        
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const columnType = structure.columnTypes[i] || 'text';
            
            processedRow.push(this.processFinancialCell(cell, columnType));
        }
        
        return processedRow;
    }

    // עיבוד תא כספי יחיד
    processFinancialCell(cell, columnType) {
        if (!cell || !cell.trim()) {
            return '';
        }

        const trimmed = cell.trim();
        
        switch (columnType) {
            case 'amount':
                return this.normalizeAmount(trimmed);
            case 'date':
                return this.normalizeDate(trimmed);
            case 'account':
                return this.normalizeAccountNumber(trimmed);
            case 'numeric':
                return this.normalizeNumber(trimmed);
            default:
                return trimmed;
        }
    }

    // נרמול סכום כסף
    normalizeAmount(amount) {
        let normalized = amount
            .replace(/₪/g, '')
            .replace(/[^\d,.\-()]/g, '')
            .trim();

        // טיפול במספרים שליליים בסוגריים
        if (normalized.startsWith('(') && normalized.endsWith(')')) {
            normalized = '-' + normalized.slice(1, -1);
        }

        // הסרת פסיקים מיותרים
        normalized = normalized.replace(/,/g, '');

        // וידוא שזהו מספר תקין
        if (isNaN(parseFloat(normalized))) {
            return amount; // החזרת הערך המקורי אם לא ניתן לנרמל
        }

        return normalized;
    }

    // נרמול תאריך
    normalizeDate(date) {
        // נסיון המרה לפורמט תקני DD/MM/YYYY
        const cleaned = date.replace(/[^\d\/\-\.]/g, '');
        
        // זיהוי פורמט ואחידות
        if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(cleaned)) {
            return cleaned.replace(/[\-\.]/g, '/');
        }
        
        return date;
    }

    // נרמול מספר חשבון
    normalizeAccountNumber(account) {
        return account.replace(/[^\d\-\.]/g, '');
    }

    // נרמול מספר כללי
    normalizeNumber(number) {
        return number.replace(/,/g, '').replace(/[^\d\.]/g, '');
    }

    // בדיקה האם שורה היא גבול טבלה
    isTableBorder(line) {
        const borderChars = /^[\-_=+|*\s]+$/;
        return borderChars.test(line) && line.length > 5;
    }

    // אימות נתונים כספיים
    validateFinancialData(extractedData) {
        this.log('Starting financial data validation');
        
        if (!extractedData || extractedData.length === 0) {
            this.log('No financial data to validate', 'warn');
            return [];
        }

        const validatedData = [];
        const validationErrors = [];

        for (let rowIndex = 0; rowIndex < extractedData.length; rowIndex++) {
            const row = extractedData[rowIndex];
            const validatedRow = [];
            let hasValidData = false;

            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cell = row[colIndex];
                const validatedCell = this.validateFinancialCell(cell, rowIndex, colIndex);
                
                if (validatedCell.isValid) {
                    validatedRow.push(validatedCell.value);
                    hasValidData = true;
                } else {
                    validatedRow.push(validatedCell.value);
                    if (validatedCell.error) {
                        validationErrors.push({
                            row: rowIndex + 1,
                            col: colIndex + 1,
                            error: validatedCell.error,
                            originalValue: cell
                        });
                    }
                }
            }

            // הוספת השורה רק אם יש בה נתונים תקפים
            if (hasValidData) {
                validatedData.push(validatedRow);
            }
        }

        // תיעוד שגיאות אימות
        if (validationErrors.length > 0) {
            this.log(`Found ${validationErrors.length} validation issues:`, 'warn');
            validationErrors.slice(0, 5).forEach(error => {
                this.log(`Row ${error.row}, Col ${error.col}: ${error.error} (value: "${error.originalValue}")`, 'warn');
            });
        }

        // סטטיסטיקות אימות
        const validationStats = {
            originalRows: extractedData.length,
            validatedRows: validatedData.length,
            filteredRows: extractedData.length - validatedData.length,
            errors: validationErrors.length
        };

        this.log('Financial validation completed:', validationStats);
        
        // שמירת סטטיסטיקות לצורך דיווח
        if (!window.FinancialValidationStats) {
            window.FinancialValidationStats = [];
        }
        window.FinancialValidationStats.push(validationStats);

        return validatedData;
    }

    // אימות תא כספי יחיד
    validateFinancialCell(cellValue, rowIndex, colIndex) {
        if (!cellValue || typeof cellValue !== 'string') {
            return { isValid: true, value: '', error: null };
        }

        const trimmed = cellValue.trim();
        
        // תא ריק - תקף
        if (trimmed === '') {
            return { isValid: true, value: '', error: null };
        }

        // אימות סכומי כסף
        if (this.looksLikeAmount(trimmed)) {
            return this.validateAmount(trimmed);
        }

        // אימות תאריכים
        if (this.looksLikeDate(trimmed)) {
            return this.validateDate(trimmed);
        }

        // אימות מספרי חשבון
        if (this.looksLikeAccountNumber(trimmed)) {
            return this.validateAccountNumber(trimmed);
        }

        // טקסט רגיל - אימות בסיסי
        return this.validateText(trimmed);
    }

    // בדיקה האם נראה כמו סכום
    looksLikeAmount(value) {
        return /[₪$€£]|\d+[,.]\d+|\(\s*\d+/.test(value);
    }

    // בדיקה האם נראה כמו תאריך
    looksLikeDate(value) {
        return /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(value);
    }

    // בדיקה האם נראה כמו מספר חשבון
    looksLikeAccountNumber(value) {
        return /^\d{3,8}$|^\d+[\-\.]\d+/.test(value);
    }

    // אימות סכום כסף
    validateAmount(amount) {
        try {
            const normalized = this.normalizeAmount(amount);
            const numericValue = parseFloat(normalized);
            
            if (isNaN(numericValue)) {
                return {
                    isValid: false,
                    value: amount,
                    error: 'Invalid amount format'
                };
            }

            // בדיקת טווח סביר (עד 10 מיליארד)
            if (Math.abs(numericValue) > 10000000000) {
                return {
                    isValid: false,
                    value: amount,
                    error: 'Amount seems unreasonably large'
                };
            }

            return {
                isValid: true,
                value: normalized,
                error: null
            };

        } catch (error) {
            return {
                isValid: false,
                value: amount,
                error: `Amount validation error: ${error.message}`
            };
        }
    }

    // אימות תאריך
    validateDate(dateStr) {
        try {
            const normalized = this.normalizeDate(dateStr);
            
            // ניסיון פרסור התאריך
            const parts = normalized.split('/');
            if (parts.length !== 3) {
                return {
                    isValid: false,
                    value: dateStr,
                    error: 'Invalid date format'
                };
            }

            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            // בדיקות בסיסיות
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return {
                    isValid: false,
                    value: dateStr,
                    error: 'Date values out of valid range'
                };
            }

            return {
                isValid: true,
                value: normalized,
                error: null
            };

        } catch (error) {
            return {
                isValid: false,
                value: dateStr,
                error: `Date validation error: ${error.message}`
            };
        }
    }

    // אימות מספר חשבון
    validateAccountNumber(accountStr) {
        const normalized = this.normalizeAccountNumber(accountStr);
        
        // בדיקה שהמספר לא ריק
        if (!normalized || normalized.length === 0) {
            return {
                isValid: false,
                value: accountStr,
                error: 'Empty account number'
            };
        }

        // בדיקת אורך סביר (3-15 ספרות)
        const digitsOnly = normalized.replace(/[^\d]/g, '');
        if (digitsOnly.length < 3 || digitsOnly.length > 15) {
            return {
                isValid: false,
                value: accountStr,
                error: 'Account number length invalid'
            };
        }

        return {
            isValid: true,
            value: normalized,
            error: null
        };
    }

    // אימות טקסט
    validateText(text) {
        // בדיקת אורך מינימלי
        if (text.length > 1000) {
            return {
                isValid: false,
                value: text.substring(0, 1000) + '...',
                error: 'Text too long, truncated'
            };
        }

        // ניקוי תווים לא חוקיים
        const cleaned = text.replace(/[\x00-\x1F\x7F]/g, '');
        
        return {
            isValid: true,
            value: cleaned,
            error: null
        };
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