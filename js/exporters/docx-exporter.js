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
        
        const fileName = options.fileName || this.generateFileName('converted_data', 'doc');
        const normalizedData = this.normalizeData(data);
        
        // יצירת קובץ HTML עם Word compatibility headers
        const htmlContent = this.createWordCompatibleHTML(normalizedData, options);
        
        // הורדת הקובץ עם MIME type של Word
        const blob = new Blob([htmlContent], {
            type: 'application/vnd.ms-word;charset=utf-8'
        });
        
        this.downloadBlob(blob, fileName.replace('.docx', '.doc'));
        
        this.log(`HTML-Word fallback export completed: ${fileName}`);
        
        return {
            success: true,
            fileName: fileName.replace('.docx', '.doc'),
            format: 'doc',
            note: 'הקובץ יורד כ-DOC ויפתח ב-Word. תוכל לשמור אותו כ-DOCX מתוך Word.'
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
    mso-table-wrap: around;
    mso-table-lspace: 9.0pt;
    mso-table-rspace: 9.0pt;
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
        let table = '<table>';
        
        data.forEach((row, rowIndex) => {
            const tag = rowIndex === 0 ? 'th' : 'td';
            table += '<tr>';
            row.forEach(cell => {
                const cellText = this.escapeHTML(String(cell || ''));
                table += `<${tag}>${cellText}</${tag}>`;
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
            paragraphs += `<p>${escapedText}</p>`;
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

    // יצירת מסמך RTF פשוט עם תמיכה בעברית
    createRTFDocument(data, options = {}) {
        const settings = {
            rtl: options.rtl !== false,
            fontSize: (options.fontSize || 12) * 2, // RTF uses half-points
            fontFamily: options.fontFamily || 'David',
            asTable: options.asTable !== false,
            title: options.title || 'מסמך מומר מ-PDF'
        };

        // התחלת מסמך RTF עם קידוד Unicode מלא
        let rtf = '{\\rtf1\\ansi\\ansicpg1255\\deff0\\deflang1037';
        rtf += '{\\fonttbl{\\f0\\froman\\fcharset177\\fprq2 David;}{\\f1\\froman\\fcharset0\\fprq2 Arial;}}';
        rtf += '{\\colortbl;\\red0\\green0\\blue0;}';
        rtf += '\\viewkind4\\uc1\\pard';
        
        if (settings.rtl) {
            rtf += '\\rtlpar\\qr '; // RTL paragraph alignment
        }
        
        rtf += '\\f0\\fs' + settings.fontSize + '\\cf1 ';

        // כותרת
        if (settings.title) {
            rtf += '\\b ' + this.convertToRTFHebrew(settings.title) + '\\b0\\par\\par ';
        }

        // תוכן
        if (settings.asTable && data.length > 0) {
            rtf += this.createRTFTableHebrew(data, settings);
        } else {
            rtf += this.createRTFParagraphsHebrew(data, settings);
        }

        rtf += '}';
        return rtf;
    }

    // המרת טקסט עברי ל-RTF עם Unicode
    convertToRTFHebrew(text) {
        if (!text) return '';
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charCode = char.charCodeAt(0);
            
            // תווים עבריים (1488-1514) ותווים מיוחדים
            if (charCode >= 1488 && charCode <= 1514) {
                result += '\\u' + charCode + '?';
            } else if (charCode > 127) {
                result += '\\u' + charCode + '?';
            } else if (char === '\\') {
                result += '\\\\';
            } else if (char === '{') {
                result += '\\{';
            } else if (char === '}') {
                result += '\\}';
            } else {
                result += char;
            }
        }
        return result;
    }

    createRTFTableHebrew(data, settings) {
        let table = '';
        
        data.forEach((row, rowIndex) => {
            table += '\\trowd\\trgaph120\\trleft0\\trqr '; // RTL table
            
            // הגדרת עמודות
            const cellWidth = Math.floor(9000 / row.length);
            for (let i = 0; i < row.length; i++) {
                table += '\\cellx' + ((i + 1) * cellWidth) + ' ';
            }
            
            // תוכן השורה
            row.forEach(cell => {
                const cellText = this.convertToRTFHebrew(String(cell || ''));
                table += '\\intbl\\rtlch\\ltrch ' + cellText + '\\cell ';
            });
            
            table += '\\row ';
        });
        
        return table;
    }

    createRTFParagraphsHebrew(data, settings) {
        let paragraphs = '';
        
        data.forEach(row => {
            const text = Array.isArray(row) ? row.join(' | ') : String(row);
            const convertedText = this.convertToRTFHebrew(text);
            
            if (settings.rtl) {
                paragraphs += '\\rtlpar\\qr ' + convertedText + '\\par\\par ';
            } else {
                paragraphs += convertedText + '\\par\\par ';
            }
        });
        
        return paragraphs;
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
            children.push(this.createTitle(settings.title, settings));
        }

        // יצירת התוכן העיקרי
        if (settings.asTable && data.length > 0) {
            children.push(this.createTable(data, settings));
        } else {
            children.push(...this.createParagraphs(data, settings));
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
            description: "מסמך שהומר מקובץ PDF",
            lastModifiedBy: "PDF Converter",
        });

        return document;
    }

    createTitle(titleText, settings, docx) {
        return new docx.Paragraph({
            children: [
                new docx.TextRun({
                    text: titleText,
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

        // יצירת שורות הטבלה
        const tableRows = data.map((row, rowIndex) => {
            return new docx.TableRow({
                children: row.map((cell, cellIndex) => {
                    return this.createTableCell(cell, rowIndex === 0, settings, docx);
                })
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
            layout: docx.TableLayoutType.AUTOFIT,
            columnWidths: this.calculateColumnWidths(data),
        });
    }

    createTableCell(cellText, isHeader, settings, docx) {
        const text = this.cleanHebrewText(String(cellText || ''));
        const isHebrew = this.isHebrewText(text);
        
        return new docx.TableCell({
            children: [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: text,
                            bold: isHeader,
                            size: settings.fontSize * 2,
                            font: settings.fontFamily,
                        })
                    ],
                    alignment: isHebrew || settings.rtl ? 
                        docx.AlignmentType.RIGHT : 
                        docx.AlignmentType.LEFT,
                    bidirectional: isHebrew || settings.rtl,
                })
            ],
            shading: isHeader ? {
                fill: "E7E6E6",
                type: docx.ShadingType.SOLID,
            } : undefined,
            margins: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100,
            },
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

        for (let col = 0; col < maxCols; col++) {
            let maxLength = 0;
            
            for (let row = 0; row < Math.min(data.length, 10); row++) { // בדיקת 10 שורות ראשונות
                if (data[row][col]) {
                    const cellLength = String(data[row][col]).length;
                    maxLength = Math.max(maxLength, cellLength);
                }
            }
            
            // חישוב רוחב יחסי (מינימום 1000, מקסימום 4000)
            const width = Math.min(Math.max(maxLength * 150, 1000), 4000);
            widths.push(width);
        }

        return widths;
    }

    createParagraphs(data, settings) {
        const paragraphs = [];

        data.forEach((row, rowIndex) => {
            if (Array.isArray(row)) {
                // שורה עם מספר תאים
                const rowText = row.filter(cell => cell && String(cell).trim()).join(' | ');
                if (rowText) {
                    paragraphs.push(this.createParagraph(rowText, settings));
                }
            } else {
                // תא בודד
                const text = String(row).trim();
                if (text) {
                    paragraphs.push(this.createParagraph(text, settings));
                }
            }

            // רווח בין שורות
            if (rowIndex < data.length - 1) {
                paragraphs.push(this.createEmptyParagraph());
            }
        });

        return paragraphs;
    }

    createParagraph(text, settings) {
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

    createEmptyParagraph() {
        return new docx.Paragraph({
            children: [new docx.TextRun({ text: "" })],
            spacing: { after: 100 },
        });
    }

    async downloadDocument(document, fileName) {
        try {
            const docx = window.docx; // התייחסות לספרייה הגלובלית
            
            // יצירת הקובץ
            const buffer = await docx.Packer.toBuffer(document);
            
            // יצירת Blob והורדה
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            this.downloadBlob(blob, fileName);
            
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
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

    // יצירת מסמך עם עיצוב מתקדם
    createFormattedTable(data, options = {}) {
        const tableOptions = {
            asTable: true,
            rtl: true,
            borders: true,
            headerStyle: {
                bold: true,
                backgroundColor: 'E7E6E6',
                fontSize: 14
            },
            cellPadding: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100
            },
            ...options
        };

        return this.export(data, tableOptions);
    }

    // יצירת מסמך עם כותרות מותאמות
    createDocumentWithHeaders(data, headers, options = {}) {
        // הוספת כותרות לנתונים
        const dataWithHeaders = [headers, ...data];
        
        const headerOptions = {
            hasHeaders: true,
            title: options.title || 'דוח נתונים',
            ...options
        };

        return this.export(dataWithHeaders, headerOptions);
    }

    // יצירת מסמך עם מידע נוסף
    createDetailedDocument(data, options = {}) {
        const detailedOptions = {
            title: options.title || 'דוח מפורט',
            subtitle: options.subtitle,
            author: options.author || 'PDF Converter',
            date: new Date().toLocaleDateString('he-IL'),
            includeMetadata: true,
            includeSummary: true,
            ...options
        };

        return this.export(data, detailedOptions);
    }

    // בדיקת תמיכה בגופנים עבריים
    validateHebrewFontSupport() {
        const hebrewFonts = ['David', 'Arial Hebrew', 'Times New Roman', 'Calibri'];
        
        // בדיקה בסיסית של תמיכה בגופן (לא מושלמת בדפדפן)
        return hebrewFonts.map(font => ({
            name: font,
            supported: true // נניח שכל הגופנים נתמכים
        }));
    }

    // יצירת סגנונות מותאמים אישית
    createCustomStyles(options = {}) {
        return {
            heading1: {
                size: (options.titleFontSize || 16) * 2,
                bold: true,
                font: options.fontFamily || 'David'
            },
            heading2: {
                size: (options.subtitleFontSize || 14) * 2,
                bold: true,
                font: options.fontFamily || 'David'
            },
            normal: {
                size: (options.fontSize || 12) * 2,
                font: options.fontFamily || 'David'
            },
            tableHeader: {
                size: (options.fontSize || 12) * 2,
                bold: true,
                font: options.fontFamily || 'David'
            }
        };
    }

    // יצירת תצוגה מקדימה של DOCX
    createPreview(data, maxRows = 10) {
        const previewData = data.slice(0, maxRows);
        
        return {
            data: previewData,
            truncated: data.length > maxRows,
            totalRows: data.length,
            previewRows: previewData.length,
            estimatedSize: this.estimateDocumentSize(previewData)
        };
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