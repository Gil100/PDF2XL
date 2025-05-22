// Base Exporter Class - ממשק אחיד לכל פורמטי הייצוא
// js/exporters/base-exporter.js

class BaseExporter {
    constructor() {
        this.isReady = false;
        this.loadingPromise = null;
    }

    // פונקציה מופשטת שכל exporter צריך לממש
    async export(data, options = {}) {
        throw new Error('Export method must be implemented by subclass');
    }

    // טעינת ספריות חיצוניות
    async loadScript(src, globalVarName = null) {
        return new Promise((resolve, reject) => {
            // בדיקה אם הספרייה כבר טעונה
            if (globalVarName && window[globalVarName]) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ Failed to load: ${src}`);
                reject(new Error(`Failed to load script: ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }

    // וידוא שהמודול מוכן לשימוש
    async ensureReady() {
        if (this.isReady) return;
        
        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        this.loadingPromise = this.initialize();
        await this.loadingPromise;
        this.isReady = true;
    }

    // פונקציה מופשטת לאתחול המודול
    async initialize() {
        // יש לממש במחלקות יורשות
    }

    // יצירת שם קובץ ברירת מחדל
    generateFileName(baseName, extension) {
        const timestamp = new Date().toISOString().split('T')[0];
        return `${baseName}_${timestamp}.${extension}`;
    }

    // המרת נתונים לפורמט מתאים
    normalizeData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Data must be a non-empty array');
        }

        // וידוא שכל השורות באותו אורך
        const maxColumns = Math.max(...data.map(row => Array.isArray(row) ? row.length : 0));
        
        return data.map(row => {
            if (!Array.isArray(row)) {
                row = [row];
            }
            
            // השלמת עמודות חסרות
            while (row.length < maxColumns) {
                row.push('');
            }
            
            // ניקוי וודא שהערכים הם מחרוזות
            return row.map(cell => {
                if (cell === null || cell === undefined) return '';
                return String(cell).trim();
            });
        });
    }

    // זיהוי סוג התוכן (מספר, תאריך, טקסט)
    detectCellType(value) {
        if (!value || typeof value !== 'string') {
            return 'text';
        }

        // בדיקת מספר
        if (/^\d+(\.\d+)?$/.test(value.replace(/,/g, ''))) {
            return 'number';
        }

        // בדיקת תאריך (פורמטים שונים)
        if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(value) ||
            /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(value)) {
            return 'date';
        }

        // בדיקת זמן
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
            return 'time';
        }

        return 'text';
    }

    // זיהוי אם הטקסט הוא בעברית
    isHebrewText(text) {
        if (typeof text !== 'string') return false;
        return /[\u0590-\u05FF]/.test(text);
    }

    // ניקוי וטיפול בטקסט עברי
    cleanHebrewText(text) {
        if (typeof text !== 'string') return text;
        
        // הסרת תווים מיוחדים שעלולים לגרום בעיות
        return text
            .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // הסרת תווי כיוון
            .trim();
    }

    // יצירת הודעת שגיאה ידידותית למשתמש
    createUserFriendlyError(error, operation = 'ייצוא') {
        console.error('Export error:', error);
        
        let userMessage = `שגיאה ב${operation}: `;
        
        if (error.name === 'TypeError') {
            userMessage += 'נתונים לא תקינים';
        } else if (error.name === 'NetworkError') {
            userMessage += 'בעיית רשת - בדוק חיבור לאינטרנט';
        } else if (error.message.includes('script')) {
            userMessage += 'שגיאה בטעינת ספריות חיצוניות';
        } else {
            userMessage += error.message || 'שגיאה לא ידועה';
        }

        return userMessage;
    }

    // לוגים לצרכי ניפוי שגיאות
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[${this.constructor.name}] ${timestamp}:`;
        
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

// ייצוא למודולים אחרים
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseExporter;
} else {
    window.BaseExporter = BaseExporter;
}