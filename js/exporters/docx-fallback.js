// DOCX Fallback - Simple RTF Export without external dependencies
// js/exporters/docx-fallback.js

class SimpleDOCXFallback {
    constructor() {
        // זה מודול fallback שלא דורש ספריות חיצוניות
    }

    createSimpleRTF(data, options = {}) {
        const settings = {
            rtl: options.rtl !== false,
            fontSize: options.fontSize || 12,
            fontFamily: options.fontFamily || 'David',
            asTable: options.asTable !== false,
            title: options.title || 'מסמך מומר מ-PDF'
        };

        // RTF header עם תמיכה בעברית
        let rtf = '{\\rtf1\\ansi\\ansicpg1255\\deff0\\deflang1037';
        
        // טבלת גופנים
        rtf += '{\\fonttbl';
        rtf += '{\\f0\\fnil\\fcharset177 ' + settings.fontFamily + ';}';
        rtf += '{\\f1\\fnil\\fcharset0 Arial;}';
        rtf += '}';
        
        // טבלת צבעים
        rtf += '{\\colortbl;\\red0\\green0\\blue0;\\red128\\green128\\blue128;}';
        
        // הגדרות מסמך
        rtf += '\\paperw11906\\paperh16838\\margl1134\\margr1134\\margt1134\\margb1134';
        
        if (settings.rtl) {
            rtf += '\\rtldoc\\rtlpar';
        }
        
        rtf += '\\fs' + (settings.fontSize * 2) + '\\f0 ';
        
        // כותרת
        if (settings.title) {
            rtf += '\\pard\\qc\\b\\fs' + ((settings.fontSize + 4) * 2) + ' ';
            rtf += this.escapeRTF(settings.title) + '\\b0\\par\\par ';
        }
        
        // תוכן
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
        const maxCols = Math.max(...data.map(row => row.length));
        const colWidth = Math.floor(8500 / maxCols);
        
        data.forEach((row, rowIndex) => {
            table += '\\trowd\\trgaph115\\trleft0';
            
            for (let i = 0; i < row.length; i++) {
                const cellPos = (i + 1) * colWidth;
                table += '\\cellx' + cellPos;
            }
            
            row.forEach((cell, cellIndex) => {
                const cellText = String(cell || '');
                const isHebrew = this.isHebrewText(cellText);
                
                table += '\\pard\\intbl';
                if (isHebrew || settings.rtl) {
                    table += '\\rtlch\\qr ';
                } else {
                    table += '\\ltrch\\ql ';
                }
                
                if (rowIndex === 0) {
                    table += '\\b ';
                }
                
                table += this.escapeRTF(cellText);
                
                if (rowIndex === 0) {
                    table += '\\b0 ';
                }
                
                table += '\\cell ';
            });
            
            table += '\\row ';
        });
        
        return table;
    }

    createRTFParagraphs(data, settings) {
        let paragraphs = '';
        
        data.forEach(row => {
            const text = Array.isArray(row) ? row.join(' | ') : String(row);
            const isHebrew = this.isHebrewText(text);
            
            if (isHebrew || settings.rtl) {
                paragraphs += '\\rtlpar\\qr ' + this.escapeRTF(text) + '\\par ';
            } else {
                paragraphs += '\\ltrpar\\ql ' + this.escapeRTF(text) + '\\par ';
            }
        });
        
        return paragraphs;
    }

    isHebrewText(text) {
        return /[\u0590-\u05FF]/.test(text);
    }

    escapeRTF(text) {
        if (!text) return '';
        
        text = String(text)
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}');
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charCode = char.charCodeAt(0);
            
            if (charCode < 128) {
                result += char;
            } else {
                result += '\\u' + charCode + '?';
            }
        }
        
        return result;
    }

    exportAsRTF(data, fileName, options = {}) {
        const rtfContent = this.createSimpleRTF(data, options);
        
        const blob = new Blob([rtfContent], {
            type: 'application/rtf'
        });
        
        const rtfFileName = fileName.replace('.docx', '.rtf');
        this.downloadBlob(blob, rtfFileName);
        
        return {
            success: true,
            fileName: rtfFileName,
            format: 'rtf',
            note: 'הקובץ נוצר כקובץ RTF תואם Word'
        };
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
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleDOCXFallback;
} else {
    window.SimpleDOCXFallback = SimpleDOCXFallback;
}