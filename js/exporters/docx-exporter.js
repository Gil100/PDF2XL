// DOCX Exporter Module - ייצוא לקבצי Word
// js/exporters/docx-exporter.js

class DOCXExporter extends BaseExporter {
    constructor() {
        super();
        this.docxLoaded = false;
    }

    async initialize() {
        this.log('Initializing DOCX exporter...');
        
        // בדיקה אם הספרייה זמינה מ-CDN
        if (typeof window.docx !== 'undefined' && window.docx.Document) {
            this.docxLoaded = true;
            this.log('DOCX library loaded from CDN');
            return;
        } 
        
        // חכה עד שהספרייה תיטען (עד 15 שניות)
        let attempts = 0;
        const maxAttempts = 75; // 15 שניות
        
        while (attempts < maxAttempts && (typeof window.docx === 'undefined' || !window.docx.Document)) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
            
            // בדיקה מיוחדת אם יש סימן לכשל בטעינה
            if (window.docxLoadFailed) {
                this.log('DOCX loading failed flag detected', 'warn');
                break;
            }
        }
        
        if (typeof window.docx !== 'undefined' && window.docx.Document) {
            this.docxLoaded = true;
            this.log('DOCX library loaded after waiting');
            return;
        } else {
            this.log('DOCX library not available after waiting. Using enhanced RTF fallback.', 'warn');
            this.docxLoaded = false;
        }
    }

    async export(data, options = {}) {
        try {
            await this.ensureReady();
            
            this.log('Starting DOCX export process', 'debug');
            
            // בדיקה נוספת שהספרייה זמינה וישימה
            if (!this.isDocxAvailable()) {
                this.log('Main DOCX library not available, using fallback', 'warn');
                return await this.exportWithFallback(data, options);
            }
            
            this.log('Using native DOCX library for export', 'debug');
            
            // נירמול הנתונים
            const normalizedData = this.normalizeData(data);
            if (!normalizedData || normalizedData.length === 0) {
                throw new Error('אין נתונים לייצוא');
            }
            
            // יצירת מסמך Word
            this.log('Creating DOCX document', 'debug');
            const document = this.createDocument(normalizedData, options);
            
            // יצירת ההורדה
            let fileName = options.fileName || this.generateFileName('converted_data', 'docx');
            
            // וידוא שיש סיומת .docx
            if (!fileName.toLowerCase().endsWith('.docx')) {
                fileName += '.docx';
            }

            await this.downloadDocument(document, fileName);
            
            this.log(`DOCX export completed successfully: ${fileName}`);
            
            return {
                success: true,
                fileName: fileName,
                format: 'docx'
            };
            
        } catch (error) {
            this.log(`DOCX export failed: ${error.message}`, 'error');
            console.error("DOCX export error details:", error);
            
            // ניסיון fallback אוטומטי
            try {
                this.log('Attempting fallback DOCX export', 'warn');
                return await this.exportWithFallback(data, options);
            } catch (fallbackError) {
                this.log(`Fallback also failed: ${fallbackError.message}`, 'error');
                throw new Error(`ייצוא Word נכשל: ${error.message}. גם ה-fallback נכשל: ${fallbackError.message}`);
            }
        }
    }

    // ייצוא עם fallback משופר יותר (RTF עם Word compatibility)
    async exportWithFallback(data, options = {}) {
        this.log('Using enhanced RTF-to-Word fallback export method', 'warn');
        
        try {
            // נסיון להשתמש ב-SimpleDOCXFallback אם זמין
            if (typeof SimpleDOCXFallback !== 'undefined') {
                const fallbackExporter = new SimpleDOCXFallback();
                let fileName = options.fileName || this.generateFileName('converted_data', 'docx');
                
                const normalizedData = this.normalizeData(data);
                if (!normalizedData || normalizedData.length === 0) {
                    throw new Error('אין נתונים לייצוא');
                }
                
                return fallbackExporter.exportAsRTF(normalizedData, fileName, options);
            }
        } catch (fallbackError) {
            this.log(`SimpleDOCXFallback failed: ${fallbackError.message}`, 'warn');
        }
        
        // fallback של fallback - שיטה פשוטה מאוד
        let fileName = options.fileName || this.generateFileName('converted_data', 'docx');
        
        // וידוא שהקובץ יקבל סיומת .docx
        if (!fileName.toLowerCase().endsWith('.docx')) {
            fileName += '.docx';
        }
        
        const normalizedData = this.normalizeData(data);
        
        // יצירת קובץ RTF משופר עם Word compatibility headers
        const rtfContent = this.createWordCompatibleRTF(normalizedData, options);
        
        // שימוש ב-MIME type של RTF במקום DOCX (יותר יציב)
        const blob = new Blob([rtfContent], {
            type: 'application/rtf'
        });
        
        // שינוי סיומת קובץ ל-.rtf לתאימות טובה יותר
        const rtfFileName = fileName.replace('.docx', '.rtf');
        
        this.downloadBlob(blob, rtfFileName);
        
        this.log(`RTF fallback export completed: ${rtfFileName}`);
        
        return {
            success: true,
            fileName: rtfFileName,
            format: 'rtf',
            note: 'הקובץ נוצר כקובץ RTF תואם Word. הקובץ ייפתח ב-Microsoft Word ללא בעיות. אם תרצה שמירה כ-DOCX, פתח ב-Word ושמור מחדש.'
        };
    }

    // יצירת RTF תואם Word עם תמיכה מלאה בעברית
    createWordCompatibleRTF(data, options = {}) {
        const settings = {
            rtl: options.rtl !== false,
            fontSize: options.fontSize || 12,
            fontFamily: options.fontFamily || 'David',
            asTable: options.asTable !== false,
            title: options.title || 'מסמך מומר מ-PDF'
        };

        // RTF header עם תמיכה בעברית ו-Unicode מתקדמת
        let rtf = '{\\rtf1\\ansi\\ansicpg1255\\deff0\\deflang1037';
        
        // טבלת גופנים עם תמיכה בעברית
        rtf += '{\\fonttbl';
        rtf += '{\\f0\\fnil\\fcharset177 ' + settings.fontFamily + ';}';
        rtf += '{\\f1\\fnil\\fcharset0 Arial;}';
        rtf += '{\\f2\\fnil\\fcharset177 Times New Roman;}';
        rtf += '}';
        
        // טבלת צבעים
        rtf += '{\\colortbl;\\red0\\green0\\blue0;\\red128\\green128\\blue128;\\red255\\green0\\blue0;}';
        
        // הגדרות מסמך
        rtf += '\\paperw11906\\paperh16838\\margl1134\\margr1134\\margt1134\\margb1134';
        
        // הגדרות RTL בסיסיות
        if (settings.rtl) {
            rtf += '\\rtldoc\\rtlpar';
        }
        
        rtf += '\\fs' + (settings.fontSize * 2) + '\\f0 '; // RTF uses half-points
        
        // כותרת מסמך
        if (settings.title) {
            const cleanTitle = this.cleanHebrewText(settings.title);
            rtf += '\\pard\\qc\\b\\fs' + ((settings.fontSize + 6) * 2) + ' ';
            rtf += this.escapeRTF(cleanTitle) + '\\b0\\par\\par ';
        }
        
        // תוכן עיקרי
        if (settings.asTable && data.length > 0) {
            rtf += this.createRTFTable(data, settings);
        } else {
            rtf += this.createRTFParagraphs(data, settings);
        }
        
        rtf += '}';
        return rtf;
    }

    createRTFTable(data, settings) {
        let table = '';
        
        // הגדרות כלליות לטבלה
        const maxCols = Math.max(...data.map(row => row.length));
        const colWidth = Math.floor(8500 / maxCols); // רוחב עמודות יחסי
        
        data.forEach((row, rowIndex) => {
            // התחלת שורה עם הגדרות
            table += '\\trowd\\trgaph115\\trleft0';
            
            // הגדרת גבולות טבלה
            table += '\\trbrdrl\\brdrs\\brdrw10\\brdrcf1';
            table += '\\trbrdrt\\brdrs\\brdrw10\\brdrcf1';
            table += '\\trbrdrr\\brdrs\\brdrw10\\brdrcf1';
            table += '\\trbrdrb\\brdrs\\brdrw10\\brdrcf1';
            
            // הגדרת עמודות
            for (let i = 0; i < row.length; i++) {
                const cellPos = (i + 1) * colWidth;
                table += '\\clbrdrl\\brdrs\\brdrw10\\brdrcf1';
                table += '\\clbrdrt\\brdrs\\brdrw10\\brdrcf1';
                table += '\\clbrdrr\\brdrs\\brdrw10\\brdrcf1';
                table += '\\clbrdrb\\brdrs\\brdrw10\\brdrcf1';
                table += '\\cellx' + cellPos;
            }
            
            // תוכן השורה
            row.forEach((cell, cellIndex) => {
                const cellText = this.cleanHebrewText(String(cell || ''));
                const isHebrew = this.isHebrewText(cellText);
                
                // הגדרות תא
                table += '\\pard\\intbl';
                
                if (isHebrew || settings.rtl) {
                    table += '\\rtlch\\qr ';
                } else {
                    table += '\\ltrch\\ql ';
                }
                
                // עיצוב כותרת (שורה ראשונה)
                if (rowIndex === 0) {
                    table += '\\b ';
                }
                
                table += this.escapeRTF(cellText);
                
                if (rowIndex === 0) {
                    table += '\\b0 ';
                }
                
                table += '\\cell ';
            });
            
            // סיום שורה
            table += '\\row ';
        });
        
        return table;
    }

    createRTFParagraphs(data, settings) {
        let paragraphs = '';
        
        data.forEach(row => {
            const text = Array.isArray(row) ? row.join(' | ') : String(row);
            const cleanText = this.cleanHebrewText(text);
            const isHebrew = this.isHebrewText(cleanText);
            
            if (isHebrew || settings.rtl) {
                paragraphs += '\\rtlpar\\qr ' + this.escapeRTF(cleanText) + '\\par ';
            } else {
                paragraphs += '\\ltrpar\\ql ' + this.escapeRTF(cleanText) + '\\par ';
            }
        });
        
        return paragraphs;
    }

    escapeRTF(text) {
        if (!text) return '';
        
        // המרה לstring אם צריך
        text = String(text);
        
        // escape של תווים בסיסיים
        text = text
            .replace(/\\/g, '\\\\')    // Escape backslashes
            .replace(/\{/g, '\\{')     // Escape braces
            .replace(/\}/g, '\\}');    // Escape braces
        
        // טיפול בתווי Unicode (כולל עברית)
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charCode = char.charCodeAt(0);
            
            // תווים ASCII רגילים
            if (charCode < 128) {
                result += char;
            }
            // תווים Unicode (כולל עברית)
            else {
                result += '\\u' + charCode + '?';
            }
        }
        
        return result;
    }

    // Check if text contains Hebrew characters
    isHebrewText(text) {
        return /[\u0590-\u05FF]/.test(text);
    }
    
    // Clean Hebrew text and handle RTL issues with better encoding
    cleanHebrewText(text) {
        if (!text) return '';
        
        // המרה לstring אם צריך
        text = String(text);
        
        // ניקוי תווי בקרה שיכולים להפריע לתצוגה תקינה
        text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        
        // הסרת RTL markers מיותרים
        text = text.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
        
        // תיקון encoding issues נפוצים בעברית
        text = text.replace(/Ã¢â‚¬â„¢/g, '\''); // smart quote
        text = text.replace(/Ã¢â‚¬Å"/g, '"');  // smart quote
        text = text.replace(/Ã—/g, '×'); // multiplication sign confused with Hebrew
        text = text.replace(/Ã¸/g, 'ø'); // various encoding fixes
        
        // תיקון בעיות UTF-8 נפוצות
        try {
            // ניסיון לתקן double-encoding אם קיים
            if (text.includes('Ã')) {
                const decoded = decodeURIComponent(escape(text));
                if (this.isHebrewText(decoded)) {
                    text = decoded;
                }
            }
        } catch (e) {
            // אם הפענוח נכשל, נשאיר את הטקסט המקורי
        }
        
        return text.trim();
    }

    // בדיקה שהספרייה זמינה ופועלת
    isDocxAvailable() {
        try {
            const docx = window.docx;
            
            // בדיקה בסיסית שהספרייה קיימת
            if (!docx) {
                this.log('DOCX library not found in window.docx', 'debug');
                return false;
            }
            
            // בדיקה שהמחלקות הנדרשות קיימות
            const requiredClasses = ['Document', 'Paragraph', 'TextRun', 'Table', 'TableRow', 'TableCell'];
            for (const className of requiredClasses) {
                if (typeof docx[className] !== 'function') {
                    this.log(`DOCX class ${className} not available`, 'debug');
                    return false;
                }
            }
            
            // בדיקה ש-Packer קיים
            if (!docx.Packer || typeof docx.Packer.toBuffer !== 'function') {
                this.log('DOCX Packer not available or invalid', 'debug');
                return false;
            }
            
            this.log('DOCX library is fully available', 'debug');
            return true;
            
        } catch (error) {
            this.log(`DOCX availability check failed: ${error.message}`, 'error');
            return false;
        }
    }

    createDocument(data, options = {}) {
        const docx = window.docx;
        const settings = {
            rtl: options.rtl !== false,           // RTL כברירת מחדל
            fontSize: options.fontSize || 12,     // גודל גופן
            fontFamily: options.fontFamily || 'David', // גופן עברי
            asTable: options.asTable !== false,   // כטבלה כברירת מחדל
            title: options.title || 'מסמך מומר מ-PDF',
            margins: options.margins || { top: 720, right: 720, bottom: 720, left: 720 },
            ...options
        };

        // יצירת תוכן המסמך
        const children = [];

        // הוספת כותרת אם נדרש
        if (settings.title) {
            children.push(this.createTitle(settings.title, settings, docx));
        }

        // יצירת התוכן העיקרי
        if (settings.asTable && data.length > 0) {
            children.push(this.createTable(data, settings, docx));
        } else {
            children.push(...this.createParagraphs(data, settings, docx));
        }

        // יצירת המסמך
        const document = new docx.Document({
            sections: [{
                properties: {
                    page: {
                        margin: settings.margins,
                        size: {
                            orientation: docx.PageOrientation.PORTRAIT,
                        },
                    },
                },
                children: children
            }],
            creator: "PDF to Excel/CSV Converter",
            title: settings.title,
            description: "מסמך שהומר מ-PDF",
            lastModifiedBy: "PDF Converter",
        });

        return document;
    }

    createTitle(titleText, settings, docx) {
        return new docx.Paragraph({
            children: [
                new docx.TextRun({
                    text: this.cleanHebrewText(titleText),
                    bold: true,
                    size: (settings.fontSize + 4) * 2, // Word uses half-points
                    font: settings.fontFamily,
                })
            ],
            alignment: settings.rtl ? docx.AlignmentType.RIGHT : docx.AlignmentType.CENTER,
            bidirectional: settings.rtl,
            spacing: { after: 400 }, // רווח אחרי הכותרת
        });
    }

    createTable(data, settings, docx) {
        if (!data || data.length === 0) {
            return this.createParagraph('אין נתונים להצגה', settings, docx);
        }

        // Calculate proper column widths
        const columnWidths = this.calculateColumnWidths(data);
        
        // יצירת שורות הטבלה
        const tableRows = data.map((row, rowIndex) => {
            return new docx.TableRow({
                children: row.map((cell, cellIndex) => {
                    return this.createTableCell(cell, rowIndex === 0, settings, docx);
                }),
                tableHeader: rowIndex === 0, // Mark first row as header
                cantSplit: true  // Prevent row from splitting across pages
            });
        });

        // יצירת הטבלה
        return new docx.Table({
            rows: tableRows,
            width: {
                size: 100,
                type: docx.WidthType.PERCENTAGE,
            },
            borders: this.createTableBorders(docx),
            layout: docx.TableLayoutType.FIXED,  // FIXED layout to maintain column structure
            columnWidths: columnWidths,
            alignment: settings.rtl ? docx.AlignmentType.RIGHT : docx.AlignmentType.LEFT,
            tableHeader: true,  // Enable header row
        });
    }

    createTableCell(cellText, isHeader, settings, docx) {
        const text = this.cleanHebrewText(String(cellText || ''));
        const isHebrew = this.isHebrewText(text);
        
        // Enhanced cell formatting
        return new docx.TableCell({
            children: [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: text,
                            bold: isHeader,
                            size: settings.fontSize * 2,
                            font: settings.fontFamily,
                            color: isHeader ? "000000" : "333333",
                        })
                    ],
                    alignment: isHebrew || settings.rtl ? 
                        docx.AlignmentType.RIGHT : 
                        docx.AlignmentType.LEFT,
                    bidirectional: isHebrew || settings.rtl,
                    spacing: { before: 80, after: 80 }, // Add spacing for readability
                })
            ],
            width: { size: 100, type: docx.WidthType.PERCENTAGE }, // Equal width for each cell
            shading: isHeader ? {
                fill: "E7E6E6",
                type: docx.ShadingType.SOLID,
            } : undefined,
            margins: {
                top: 100,
                bottom: 100,
                left: 120,
                right: 120,
            },
            verticalAlign: docx.VerticalAlign.CENTER, // Center content vertically
        });
    }

    createTableBorders(docx) {
        const borderStyle = {
            style: docx.BorderStyle.SINGLE,
            size: 1,
            color: "999999",
        };

        return {
            top: borderStyle,
            bottom: borderStyle,
            left: borderStyle,
            right: borderStyle,
            insideHorizontal: borderStyle,
            insideVertical: borderStyle,
        };
    }

    calculateColumnWidths(data) {
        if (!data || data.length === 0) return [];

        const maxCols = Math.max(...data.map(row => row.length));
        const widths = [];

        // First, find the maximum length for each column
        for (let col = 0; col < maxCols; col++) {
            let maxLength = 0;
            
            // Check all rows for better accuracy (not just first 10)
            for (let row = 0; row < data.length; row++) {
                if (data[row] && data[row][col]) {
                    const cellLength = String(data[row][col]).length;
                    maxLength = Math.max(maxLength, cellLength);
                }
            }
            
            // Calculate width based on content length
            // Use at least 1000 and at most 4000 units (Word's internal measurement)
            const width = Math.min(Math.max(maxLength * 200, 1000), 4000);
            widths.push(width);
        }

        return widths;
    }

    createParagraphs(data, settings, docx) {
        const paragraphs = [];

        data.forEach((row, rowIndex) => {
            if (Array.isArray(row)) {
                // שורה עם מספר תאים
                const rowText = row.filter(cell => cell && String(cell).trim()).join(' | ');
                if (rowText) {
                    paragraphs.push(this.createParagraph(rowText, settings, docx));
                }
            } else {
                // תא בודד
                const text = String(row).trim();
                if (text) {
                    paragraphs.push(this.createParagraph(text, settings, docx));
                }
            }

            // רווח בין שורות
            if (rowIndex < data.length - 1) {
                paragraphs.push(this.createEmptyParagraph(docx));
            }
        });

        return paragraphs;
    }

    createParagraph(text, settings, docx) {
        const cleanText = this.cleanHebrewText(text);
        const isHebrew = this.isHebrewText(cleanText);
        
        return new docx.Paragraph({
            children: [
                new docx.TextRun({
                    text: cleanText,
                    size: settings.fontSize * 2,
                    font: settings.fontFamily,
                })
            ],
            alignment: isHebrew || settings.rtl ? 
                docx.AlignmentType.RIGHT : 
                docx.AlignmentType.LEFT,
            bidirectional: isHebrew || settings.rtl,
            spacing: { after: 200 },
        });
    }

    createEmptyParagraph(docx) {
        return new docx.Paragraph({
            children: [new docx.TextRun({ text: "" })],
            spacing: { after: 100 },
        });
    }

    async downloadDocument(document, fileName) {
        try {
            const docx = window.docx;
            
            if (!docx || !docx.Packer) {
                throw new Error('DOCX library not properly loaded - Packer unavailable');
            }
            
            this.log('Starting document generation with DOCX Packer', 'debug');
            
            // שימוש ב-toBlob במקום toBuffer לתמיכה בדפדפנים
            let blob;
            try {
                blob = await Promise.race([
                    docx.Packer.toBlob(document),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Document generation timeout')), 30000)
                    )
                ]);
                this.log('Document blob created successfully with Packer.toBlob', 'debug');
            } catch (blobError) {
                this.log(`Packer.toBlob failed: ${blobError.message}, trying alternative method`, 'warn');
                
                // fallback אלטרנטיבי - ניסיון עם toBuffer ואז המרה
                try {
                    const buffer = await Promise.race([
                        docx.Packer.toBuffer(document),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Buffer generation timeout')), 30000)
                        )
                    ]);
                    
                    blob = new Blob([buffer], {
                        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    });
                    this.log('Document created via buffer fallback', 'debug');
                } catch (bufferError) {
                    this.log(`Both blob and buffer methods failed: ${bufferError.message}`, 'error');
                    throw new Error('Could not generate DOCX document with native library');
                }
            }
            
            // וידוא סיומת קובץ
            if (!fileName.toLowerCase().endsWith('.docx')) {
                fileName += '.docx';
            }
            
            this.downloadBlob(blob, fileName);
            this.log(`Document downloaded successfully: ${fileName}`, 'debug');
            
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
            console.error("DOCX download error details:", error);
            
            // במקרה של כשל, נסה fallback
            throw new Error(`כשל בהורדת קובץ Word: ${error.message}`);
        }
    }

    downloadBlob(blob, fileName) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // ניקוי URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

// פונקציות legacy לתאימות לאחור
function downloadAsDOCX(data, fileName) {
    const exporter = new DOCXExporter();
    return exporter.export(data, { fileName });
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOCXExporter;
} else {
    window.DOCXExporter = DOCXExporter;
    window.downloadAsDOCX = downloadAsDOCX; // תאימות לאחור
}