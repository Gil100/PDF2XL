// DOCX Exporter Module - ייצוא לקבצי Word
// js/exporters/docx-exporter.js

class DOCXExporter extends BaseExporter {
    constructor() {
        super();
        this.docxLoaded = false;
    }

    async initialize() {
        this.log('Initializing DOCX exporter...');
        
        // בדיקה אם הספרייה כבר טעונה
        if (typeof window.docx !== 'undefined') {
            this.docxLoaded = true;
            this.log('DOCX library already loaded');
            return;
        }

        // רשימת CDN לנסות
        const cdnUrls = [
            'https://unpkg.com/docx@8.5.0/build/index.js',
            'https://cdn.skypack.dev/docx@8.5.0',
            'https://esm.sh/docx@8.5.0'
        ];

        // ניסיון טעינה מכמה CDN שונים
        for (const url of cdnUrls) {
            try {
                this.log(`Trying to load DOCX from: ${url}`);
                await this.loadScript(url, 'docx');
                
                if (typeof window.docx !== 'undefined') {
                    this.docxLoaded = true;
                    this.log('DOCX library loaded successfully from: ' + url);
                    return;
                }
            } catch (error) {
                this.log(`Failed to load from ${url}: ${error.message}`, 'warn');
                continue;
            }
        }

        // אם כל הניסיונות נכשלו
        throw new Error('Failed to load DOCX library from all CDN sources');
    }

    async export(data, options = {}) {
        try {
            await this.ensureReady();
            
            // בדיקה נוספת שהספרייה זמינה וישימה
            if (!this.isDocxAvailable()) {
                this.log('Main DOCX library not available, trying fallback', 'warn');
                return await this.exportWithFallback(data, options);
            }
            
            this.log('Starting DOCX export', 'debug');
            
            // נירמול הנתונים
            const normalizedData = this.normalizeData(data);
            
            // יצירת מסמך Word
            const document = this.createDocument(normalizedData, options);
            
            // יצירת ההורדה
            const fileName = options.fileName || this.generateFileName('converted_data', 'docx');
            
            await this.downloadDocument(document, fileName);
            
            this.log(`DOCX export completed: ${fileName}`);
            
            return {
                success: true,
                fileName: fileName,
                format: 'docx'
            };
            
        } catch (error) {
            this.log(`DOCX export failed: ${error.message}`, 'error');
            console.error("DOCX export error details:", error);
            
            // ניסיון fallback
            try {
                this.log('Trying fallback DOCX export', 'warn');
                return await this.exportWithFallback(data, options);
            } catch (fallbackError) {
                this.log(`Fallback also failed: ${fallbackError.message}`, 'error');
                throw new Error(this.createUserFriendlyError(error, 'ייצוא Word'));
            }
        }
    }

    // ייצוא עם fallback משופר יותר (HTML עם Word compatibility)
    async exportWithFallback(data, options = {}) {
        this.log('Using enhanced HTML-to-Word fallback export method', 'warn');
        
        const fileName = options.fileName || this.generateFileName('converted_data', 'docx');
        const normalizedData = this.normalizeData(data);
        
        // יצירת קובץ HTML עם Word compatibility headers
        const htmlContent = this.createWordCompatibleHTML(normalizedData, options);
        
        // הורדת הקובץ עם MIME type של Word
        const blob = new Blob([htmlContent], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        this.downloadBlob(blob, fileName);
        
        this.log(`HTML-Word fallback export completed: ${fileName}`);
        
        return {
            success: true,
            fileName: fileName,
            format: 'docx',
            note: 'הקובץ נוצר ויפתח ב-Word. אם יש בעיות בפורמט, ניתן לבחור ב"שמור בשם" כדי לשמור כ-DOCX רגיל.'
        };
    }

    // יצירת HTML תואם Word עם תמיכה מלאה בעברית
    createWordCompatibleHTML(data, options = {}) {
        const settings = {
            rtl: options.rtl !== false,
            fontSize: options.fontSize || 12,
            fontFamily: options.fontFamily || 'David',
            asTable: options.asTable !== false,
            title: options.title || 'מסמך מומר מ-PDF'
        };

        let html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="UTF-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="PDF to Word Converter">
<meta name="Originator" content="PDF2XL">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>90</w:Zoom>
<w:DoNotPromptForConvert/>
<w:DoNotShowInsertionsAndDeletions/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
    margin: 1in;
    mso-page-orientation: portrait;
}
body {
    font-family: '${settings.fontFamily}', Arial, sans-serif;
    font-size: ${settings.fontSize}pt;
    direction: ${settings.rtl ? 'rtl' : 'ltr'};
    text-align: ${settings.rtl ? 'right' : 'left'};
    margin: 0;
    padding: 20px;
}
table {
    border-collapse: collapse;
    width: 100%;
    direction: ${settings.rtl ? 'rtl' : 'ltr'};
    mso-table-layout-alt: fixed;
    mso-table-lspace: 9.0pt;
    mso-table-rspace: 9.0pt;
    mso-table-layout: fixed;
}
td, th {
    border: 1px solid #999999;
    padding: 8px;
    text-align: ${settings.rtl ? 'right' : 'left'};
    vertical-align: top;
    mso-data-placement: same-cell;
}
th {
    background-color: #f0f0f0;
    font-weight: bold;
}
p {
    margin: 6pt 0;
    direction: ${settings.rtl ? 'rtl' : 'ltr'};
    text-align: ${settings.rtl ? 'right' : 'left'};
}
.title {
    font-size: ${settings.fontSize + 4}pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20px;
}
</style>
</head>
<body>`;

        // כותרת
        if (settings.title) {
            html += `<div class="title">${this.escapeHTML(settings.title)}</div>`;
        }

        // תוכן
        if (settings.asTable && data.length > 0) {
            html += this.createHTMLTable(data, settings);
        } else {
            html += this.createHTMLParagraphs(data, settings);
        }

        html += '</body></html>';
        return html;
    }

    createHTMLTable(data, settings) {
        let table = '<table border="1" cellspacing="0" cellpadding="5" style="mso-table-layout:fixed;">';
        
        // Add column width styles based on content
        table += '<colgroup>';
        const maxCols = Math.max(...data.map(row => row.length));
        for (let i = 0; i < maxCols; i++) {
            const colWidth = Math.min(Math.max(100 / maxCols, 10), 30);
            table += `<col style="width:${colWidth}%;"/>`;
        }
        table += '</colgroup>';
        
        data.forEach((row, rowIndex) => {
            const tag = rowIndex === 0 ? 'th' : 'td';
            table += '<tr>';
            row.forEach(cell => {
                const cellText = this.escapeHTML(String(cell || ''));
                const isHebrew = this.isHebrewText(cellText);
                const dirAttr = isHebrew ? ' dir="rtl"' : '';
                table += `<${tag}${dirAttr}>${cellText}</${tag}>`;
            });
            table += '</tr>';
        });
        
        table += '</table>';
        return table;
    }

    createHTMLParagraphs(data, settings) {
        let paragraphs = '';
        
        data.forEach(row => {
            const text = Array.isArray(row) ? row.join(' | ') : String(row);
            const escapedText = this.escapeHTML(text);
            const isHebrew = this.isHebrewText(escapedText);
            const dirAttr = isHebrew ? ' dir="rtl"' : '';
            paragraphs += `<p${dirAttr}>${escapedText}</p>`;
        });
        
        return paragraphs;
    }

    escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    // Check if text contains Hebrew characters
    isHebrewText(text) {
        return /[\u0590-\u05FF]/.test(text);
    }
    
    // Clean Hebrew text and handle RTL issues
    cleanHebrewText(text) {
        if (!text) return '';
        
        // Remove any control characters that might interfere with proper display
        text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        
        // Handle special RTL markers if needed
        text = text.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
        
        // Add RTL mark at the beginning of Hebrew text if needed
        if (this.isHebrewText(text) && !text.startsWith('\u200F')) {
            text = '\u200F' + text;
        }
        
        return text.trim();
    }

    // בדיקה שהספרייה זמינה ופועלת
    isDocxAvailable() {
        try {
            const docx = window.docx;
            return docx && 
                   typeof docx.Document === 'function' && 
                   typeof docx.Paragraph === 'function' && 
                   typeof docx.TextRun === 'function' &&
                   typeof docx.Table === 'function' &&
                   typeof docx.Packer === 'object';
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
            const docx = window.docx; // התייחסות לספרייה הגלובלית
            
            if (!docx || !docx.Packer) {
                throw new Error('DOCX library not properly loaded');
            }
            
            // יצירת הקובץ
            const buffer = await docx.Packer.toBuffer(document);
            
            // יצירת Blob והורדה
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            // Ensure filename has .docx extension
            if (!fileName.toLowerCase().endsWith('.docx')) {
                fileName += '.docx';
            }
            
            this.downloadBlob(blob, fileName);
            
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
            console.error("DOCX download error details:", error);
            throw new Error('כשל בהורדת קובץ Word');
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

    // פונקציות עזר נוספות

    // יצירת מסמך מעוצב עם אפשרויות מתקדמות
    createStyledDocument(data, options = {}) {
        const styledOptions = {
            rtl: true,
            fontSize: 12,
            fontFamily: 'David',
            asTable: true,
            title: 'מסמך מומר מ-PDF',
            headerColor: 'E7E6E6',
            alternateRowColors: true,
            borders: true,
            pageNumbers: true,
            ...options
        };

        return this.export(data, styledOptions);
    }

    // אומדן גודל המסמך
    estimateDocumentSize(data) {
        if (!data || data.length === 0) return 0;
        
        const totalChars = data.reduce((sum, row) => {
            if (Array.isArray(row)) {
                return sum + row.join('').length;
            }
            return sum + String(row).length;
        }, 0);

        // אומדן גס: כ-2 בתים לתו + overhead של המסמך
        return Math.round((totalChars * 2 + 10000) / 1024); // בKB
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