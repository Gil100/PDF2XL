// CSV Exporter Module - ייצוא לקבצי CSV
// js/exporters/csv-exporter.js

class CSVExporter extends BaseExporter {
    constructor() {
        super();
        this.encoding = 'utf-8';
    }

    async initialize() {
        this.log('Initializing CSV exporter...');
        // CSV לא דורש ספריות חיצוניות
        this.log('CSV exporter ready');
    }

    async export(data, options = {}) {
        try {
            await this.ensureReady();
            
            this.log('Starting CSV export', 'debug');
            
            // נירמול הנתונים
            const normalizedData = this.normalizeData(data);
            
            // יצירת תוכן CSV
            const csvContent = this.createCSVContent(normalizedData, options);
            
            // הורדת הקובץ
            const fileName = options.fileName || this.generateFileName('converted_data', 'csv');
            
            this.downloadCSV(csvContent, fileName, options);
            
            this.log(`CSV export completed: ${fileName}`);
            
            return {
                success: true,
                fileName: fileName,
                format: 'csv'
            };
            
        } catch (error) {
            this.log(`CSV export failed: ${error.message}`, 'error');
            throw new Error(this.createUserFriendlyError(error, 'ייצוא CSV'));
        }
    }

    createCSVContent(data, options = {}) {
        const settings = {
            delimiter: options.delimiter || ',',
            enclosure: options.enclosure || '"',
            lineBreak: options.lineBreak || '\n',
            bom: options.bom !== false, // BOM כברירת מחדל לתמיכה בעברית
            ...options
        };

        const csvRows = data.map(row => 
            this.formatCSVRow(row, settings)
        );

        let csvContent = csvRows.join(settings.lineBreak);

        // הוספת BOM לתמיכה בעברית ב-Excel
        if (settings.bom) {
            csvContent = '\ufeff' + csvContent;
        }

        return csvContent;
    }

    formatCSVRow(row, settings) {
        return row.map(cell => this.formatCSVCell(cell, settings)).join(settings.delimiter);
    }

    formatCSVCell(cell, settings) {
        if (cell === null || cell === undefined) {
            return '';
        }

        let value = String(cell).trim();

        // ניקוי תווים מיוחדים
        value = this.cleanCellValue(value);

        // בדיקה אם צריך להקיף במירכאות
        const needsEnclosure = this.needsEnclosure(value, settings);

        if (needsEnclosure) {
            // escape של מירכאות פנימיות
            value = value.replace(new RegExp(settings.enclosure, 'g'), 
                                settings.enclosure + settings.enclosure);
            
            return settings.enclosure + value + settings.enclosure;
        }

        return value;
    }

    cleanCellValue(value) {
        // הסרת תווי בקרה
        value = value.replace(/[\x00-\x1F\x7F]/g, '');
        
        // ניקוי תווי כיוון נוספים
        value = value.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
        
        // טיפול בשורות חדשות בתוך התא
        value = value.replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ');
        
        return value;
    }

    needsEnclosure(value, settings) {
        // מירכאות נדרשות אם יש:
        return value.includes(settings.delimiter) ||     // מפריד
               value.includes(settings.enclosure) ||     // מירכאות
               value.includes('\n') ||                   // שורה חדשה
               value.includes('\r') ||                   // carriage return
               value.startsWith(' ') ||                  // רווח בהתחלה
               value.endsWith(' ') ||                    // רווח בסוף
               /^[0-9]/.test(value) && value.includes(','); // מספר עם פסיק
    }

    downloadCSV(csvContent, fileName, options = {}) {
        try {
            // יצירת Blob עם קידוד נכון
            const blob = new Blob([csvContent], {
                type: 'text/csv;charset=utf-8;'
            });

            this.downloadBlob(blob, fileName);
            
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
            throw new Error('כשל בהורדת קובץ CSV');
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

    // יצירת CSV עם הגדרות מותאמות לעברית
    createHebrewFriendlyCSV(data, options = {}) {
        const hebrewOptions = {
            bom: true,                    // BOM הכרחי לעברית
            delimiter: ',',               // פסיק סטנדרטי
            enclosure: '"',               // מירכאות כפולות
            encoding: 'utf-8',            // קידוד UTF-8
            ...options
        };

        return this.export(data, hebrewOptions);
    }

    // יצירת CSV עם מפריד נקודה-פסיק (לאקסל באירופה)
    createEuropeanCSV(data, options = {}) {
        const europeanOptions = {
            delimiter: ';',               // נקודה-פסיק
            bom: true,
            ...options
        };

        return this.export(data, europeanOptions);
    }

    // יצירת CSV עם טאבים כמפריד
    createTSV(data, options = {}) {
        const tsvOptions = {
            delimiter: '\t',              // טאב
            bom: true,
            ...options
        };

        const fileName = options.fileName ? 
            options.fileName.replace('.csv', '.tsv') : 
            this.generateFileName('converted_data', 'tsv');

        return this.export(data, { ...tsvOptions, fileName });
    }

    // בדיקת תקינות נתונים CSV
    validateCSVData(data) {
        if (!Array.isArray(data)) {
            throw new Error('הנתונים חייבים להיות במבנה של מערך');
        }

        if (data.length === 0) {
            throw new Error('אין נתונים לייצוא');
        }

        // בדיקת עקביות מספר עמודות
        const columnCounts = data.map(row => Array.isArray(row) ? row.length : 1);
        const uniqueCounts = [...new Set(columnCounts)];
        
        if (uniqueCounts.length > 1) {
            this.log('Inconsistent column counts detected', 'warn');
        }

        // בדיקת תווים בעייתיים
        const problematicChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
        let hasProblematicChars = false;

        data.forEach((row, rowIndex) => {
            if (Array.isArray(row)) {
                row.forEach((cell, colIndex) => {
                    if (typeof cell === 'string' && problematicChars.test(cell)) {
                        this.log(`Problematic character found at row ${rowIndex}, col ${colIndex}`, 'warn');
                        hasProblematicChars = true;
                    }
                });
            }
        });

        if (hasProblematicChars) {
            this.log('Some cells contain control characters that will be cleaned', 'warn');
        }

        return true;
    }

    // יצירת תצוגה מקדימה של CSV
    createPreview(data, maxRows = 5) {
        const previewData = data.slice(0, maxRows);
        const csvContent = this.createCSVContent(previewData, { bom: false });
        
        return {
            content: csvContent,
            truncated: data.length > maxRows,
            totalRows: data.length,
            previewRows: previewData.length
        };
    }

    // המרת CSV חזרה למערך (לצרכי בדיקה)
    parseCSV(csvContent, options = {}) {
        const settings = {
            delimiter: options.delimiter || ',',
            enclosure: options.enclosure || '"',
            skipEmptyLines: options.skipEmptyLines !== false,
            ...options
        };

        // הסרת BOM אם קיים
        if (csvContent.charCodeAt(0) === 0xFEFF) {
            csvContent = csvContent.slice(1);
        }

        const lines = csvContent.split(/\r?\n/);
        const result = [];

        for (const line of lines) {
            if (settings.skipEmptyLines && !line.trim()) {
                continue;
            }

            const row = this.parseCSVLine(line, settings);
            if (row.length > 0) {
                result.push(row);
            }
        }

        return result;
    }

    parseCSVLine(line, settings) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === settings.enclosure) {
                if (inQuotes && nextChar === settings.enclosure) {
                    current += char;
                    i++; // skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === settings.delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }
}

// פונקציות legacy לתאימות לאחור
function downloadAsCSV(data, fileName) {
    const exporter = new CSVExporter();
    return exporter.export(data, { fileName });
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVExporter;
} else {
    window.CSVExporter = CSVExporter;
    window.downloadAsCSV = downloadAsCSV; // תאימות לאחור
}