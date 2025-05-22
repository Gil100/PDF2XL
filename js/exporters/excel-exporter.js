// Excel Exporter Module - ייצוא לקבצי Excel
// js/exporters/excel-exporter.js

class ExcelExporter extends BaseExporter {
    constructor() {
        super();
        this.sheetJSLoaded = false;
    }

    async initialize() {
        this.log('Initializing Excel exporter...');
        
        // טעינת SheetJS אם לא טעון
        if (typeof XLSX === 'undefined') {
            await this.loadScript(
                'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                'XLSX'
            );
        }

        this.sheetJSLoaded = true;
        this.log('Excel exporter ready');
    }

    async export(data, options = {}) {
        try {
            await this.ensureReady();
            
            this.log('Starting Excel export', 'debug');
            
            // נירמול הנתונים
            const normalizedData = this.normalizeData(data);
            
            // יצירת worksheet
            const worksheet = this.createWorksheet(normalizedData, options);
            
            // יצירת workbook
            const workbook = this.createWorkbook(worksheet, options);
            
            // הורדת הקובץ
            const fileName = options.fileName || this.generateFileName('converted_data', 'xlsx');
            
            this.downloadWorkbook(workbook, fileName);
            
            this.log(`Excel export completed: ${fileName}`);
            
            return {
                success: true,
                fileName: fileName,
                format: 'xlsx'
            };
            
        } catch (error) {
            this.log(`Excel export failed: ${error.message}`, 'error');
            throw new Error(this.createUserFriendlyError(error, 'ייצוא Excel'));
        }
    }

    createWorksheet(data, options = {}) {
        // יצירת worksheet מהנתונים
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        
        // הוספת מטא-דאטה
        this.addWorksheetMetadata(worksheet, options);
        
        // עיצוב תאים (אם נדרש)
        if (options.formatting !== false) {
            this.applyFormatting(worksheet, data, options);
        }
        
        return worksheet;
    }

    addWorksheetMetadata(worksheet, options) {
        // הוספת מידע על הטווח
        if (!worksheet['!ref']) {
            worksheet['!ref'] = XLSX.utils.encode_range({
                s: { c: 0, r: 0 },
                e: { c: 0, r: 0 }
            });
        }

        // הגדרות עמודות
        if (options.columnWidths) {
            worksheet['!cols'] = options.columnWidths.map(width => ({
                wch: width
            }));
        }

        // הגדרות שורות
        if (options.rowHeights) {
            worksheet['!rows'] = options.rowHeights.map(height => ({
                hpt: height
            }));
        }
    }

    applyFormatting(worksheet, data, options) {
        try {
            // עיצוב כותרות (שורה ראשונה)
            if (options.hasHeaders !== false && data.length > 0) {
                const headerRow = 0;
                const numCols = data[0].length;
                
                for (let col = 0; col < numCols; col++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
                    if (worksheet[cellAddress]) {
                        worksheet[cellAddress].s = {
                            font: { bold: true, sz: 12 },
                            fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "FFFFAA00" } },
                            alignment: { horizontal: "center", vertical: "center" }
                        };
                    }
                }
            }

            // זיהוי וטיפול בטקסט עברי
            this.applyHebrewFormatting(worksheet, data);
            
        } catch (error) {
            this.log(`Formatting error: ${error.message}`, 'warn');
            // ממשיכים גם אם העיצוב נכשל
        }
    }

    applyHebrewFormatting(worksheet, data) {
        data.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (this.isHebrewText(cell)) {
                    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                    if (worksheet[cellAddress]) {
                        if (!worksheet[cellAddress].s) {
                            worksheet[cellAddress].s = {};
                        }
                        if (!worksheet[cellAddress].s.alignment) {
                            worksheet[cellAddress].s.alignment = {};
                        }
                        
                        // הגדרת כיוון RTL לתאים עם עברית
                        worksheet[cellAddress].s.alignment.readingOrder = 2; // RTL
                        worksheet[cellAddress].s.alignment.horizontal = "right";
                    }
                }
            });
        });
    }

    createWorkbook(worksheet, options = {}) {
        const workbook = XLSX.utils.book_new();
        
        // הוספת worksheet לworkbook
        const sheetName = options.sheetName || 'Sheet1';
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        
        // הגדרות workbook
        this.configureWorkbook(workbook, options);
        
        return workbook;
    }

    configureWorkbook(workbook, options) {
        // הגדרות כלליות
        if (!workbook.Workbook) workbook.Workbook = {};
        if (!workbook.Workbook.Views) workbook.Workbook.Views = [];
        
        // תמיכה ב-RTL עבור עברית
        workbook.Workbook.Views[0] = { RTL: true };
        
        // מטא-דאטה
        if (!workbook.Props) workbook.Props = {};
        workbook.Props.Title = options.title || 'PDF to Excel Conversion';
        workbook.Props.Creator = 'PDF to Excel Converter';
        workbook.Props.CreatedDate = new Date();
        workbook.Props.ModifiedDate = new Date();
        
        // הגדרות נוספות
        if (options.protection) {
            workbook.Workbook.WBProps = {
                date1904: false
            };
        }
    }

    downloadWorkbook(workbook, fileName) {
        try {
            // יצירת הקובץ והורדה
            XLSX.writeFile(workbook, fileName);
            
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
            
            // חלופה - הורדה ידנית
            try {
                const wbout = XLSX.write(workbook, {
                    bookType: 'xlsx',
                    type: 'array'
                });
                
                const blob = new Blob([wbout], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                
                this.downloadBlob(blob, fileName);
                
            } catch (fallbackError) {
                this.log(`Fallback download failed: ${fallbackError.message}`, 'error');
                throw new Error('כשל בהורדת קובץ Excel');
            }
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

    // יצירת טבלה מעוצבת
    createFormattedTable(data, options = {}) {
        const tableOptions = {
            hasHeaders: true,
            formatting: true,
            columnWidths: this.calculateColumnWidths(data),
            ...options
        };

        return this.export(data, tableOptions);
    }

    // חישוב רוחב עמודות אוטומטי
    calculateColumnWidths(data) {
        if (!data || data.length === 0) return [];

        const widths = [];
        const maxCols = Math.max(...data.map(row => row.length));

        for (let col = 0; col < maxCols; col++) {
            let maxWidth = 10; // רוחב מינימלי
            
            for (let row = 0; row < data.length; row++) {
                if (data[row][col]) {
                    const cellLength = String(data[row][col]).length;
                    maxWidth = Math.max(maxWidth, Math.min(cellLength + 2, 50)); // מקסימום 50
                }
            }
            
            widths.push(maxWidth);
        }

        return widths;
    }

    // בדיקת תקינות נתונים לפני ייצוא
    validateData(data) {
        if (!Array.isArray(data)) {
            throw new Error('הנתונים חייבים להיות במבנה של מערך');
        }

        if (data.length === 0) {
            throw new Error('אין נתונים לייצוא');
        }

        // בדיקת גודל הנתונים
        const totalCells = data.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 1), 0);
        
        if (totalCells > 1000000) { // מגבלת Excel
            this.log('Large dataset detected', 'warn');
            throw new Error('הנתונים גדולים מדי עבור קובץ Excel אחד');
        }

        return true;
    }
}

// פונקציות legacy לתאימות לאחור
function downloadAsExcel(data, fileName) {
    const exporter = new ExcelExporter();
    return exporter.export(data, { fileName });
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelExporter;
} else {
    window.ExcelExporter = ExcelExporter;
    window.downloadAsExcel = downloadAsExcel; // תאימות לאחור
}