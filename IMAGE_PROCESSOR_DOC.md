# Image Processor Module Documentation

## תיעוד מודול עיבוד התמונה

### סקירה כללית
מודול `ImageProcessor` מספק כלים מתקדמים לעיבוד מקדים של תמונות PDF סרוקות לפני זיהוי OCR. המודול מותאם במיוחד לטקסט עברי וטבלאות כספיות.

### מאפיינים עיקריים
- ✅ עיבוד מקדים מתקדם לשיפור איכות OCR
- ✅ אופטימיזציה ספציפית לטקסט עברי  
- ✅ זיהוי ועיבוד טבלאות
- ✅ עצמאות מלאה (HTML5 Canvas API בלבד)
- ✅ מצב debug מובנה

## API Reference

### Constructor
```javascript
const imageProcessor = new ImageProcessor();
```

### פונקציות עיקריות

#### `enhanceForOCR(canvas, options)`
עיבוד מקדים מתקדם לזיהוי OCR

**פרמטרים:**
- `canvas` (HTMLCanvasElement) - Canvas עם התמונה המקורית
- `options` (Object) - אפשרויות עיבוד (אופציונלי)

**אפשרויות זמינות:**
```javascript
{
    scale: 3.0,              // הגדלת רזולוציה (ברירת מחדל: 3.0)
    noiseReduction: true,    // הפחתת רעש
    contrastEnhancement: true, // שיפור ניגוד
    binaryThreshold: true,   // המרה לשחור-לבן
    sharpen: true           // חידוד תמונה
}
```

**החזרה:** `HTMLCanvasElement` - Canvas מעובד

#### `optimizeForHebrew(canvas)`
אופטימיזציה ספציפית לטקסט עברי

**פרמטרים:**
- `canvas` (HTMLCanvasElement) - Canvas לעיבוד

**החזרה:** `HTMLCanvasElement` - Canvas מותאם לעברית

#### `preprocessTable(canvas)`
עיבוד מקדים לטבלאות

**פרמטרים:**
- `canvas` (HTMLCanvasElement) - Canvas עם טבלה

**החזרה:** `HTMLCanvasElement` - Canvas מעובד לטבלאות

### פונקציות עזר

#### `setDebugMode(enabled)`
הפעלת/כיבוי מצב debug

**פרמטרים:**
- `enabled` (boolean) - האם להפעיל מצב debug

## אלגוריתמים מיושמים

### 1. הפחתת רעש (Noise Reduction)
- **Gaussian Blur** עם kernel אדפטיבי
- מתאים לקבצי פקס עם רעש ברקע

### 2. שיפור ניגוד (Contrast Enhancement)
- **CLAHE** (Contrast Limited Adaptive Histogram Equalization)
- שיפור מקומי של הניגוד

### 3. חידוד תמונה (Image Sharpening)
- Convolution kernel מותאם לטקסט
- שיפור חדות התווים

### 4. המרה לשחור-לבן (Binary Threshold)
- **Otsu's Method** לחישוב threshold אוטומטי
- מותאם לתמונות סרוקות

### 5. זיהוי קווי טבלה (Table Line Detection)
- **Sobel Edge Detection** 
- זיהוי קווים אנכיים ואופקיים

## דוגמאות שימוש

### שימוש בסיסי
```javascript
const imageProcessor = new ImageProcessor();

// שיפור בסיסי לOCR
const enhanced = imageProcessor.enhanceForOCR(originalCanvas);

// אופטימיזציה לעברית
const hebrewOptimized = imageProcessor.optimizeForHebrew(enhanced);

// עיבוד טבלאות
const tableProcessed = imageProcessor.preprocessTable(hebrewOptimized);
```

### שימוש מתקדם עם אפשרויות
```javascript
const imageProcessor = new ImageProcessor();

// הפעלת מצב debug
imageProcessor.setDebugMode(true);

// עיבוד מותאם אישית
const customEnhanced = imageProcessor.enhanceForOCR(originalCanvas, {
    scale: 4.0,           // הגדלה מקסימלית
    noiseReduction: true,
    contrastEnhancement: true,
    binaryThreshold: false, // ללא threshold בשלב זה
    sharpen: true
});

// עיבוד בשלבים
let processed = imageProcessor.optimizeForHebrew(customEnhanced);
processed = imageProcessor.preprocessTable(processed);

// threshold סופי
const final = imageProcessor.enhanceForOCR(processed, {
    scale: 1.0,             // ללא הגדלה נוספת
    noiseReduction: false,
    contrastEnhancement: false,
    binaryThreshold: true,  // רק threshold
    sharpen: false
});
```

## בדיקה ופיתוח

### קובץ בדיקה
להרצת בדיקות המודול, פתח את `test-image-processor.html` בדפדפן:

```bash
# פתח בדפדפן
open test-image-processor.html
```

### בדיקות זמינות
1. **יצירת תמונת בדיקה** - תמונה עם רעש וטבלאות
2. **בדיקת שיפור OCR** - בדיקת כל שלבי העיבוד
3. **בדיקת אופטימיזציה עברית** - בדיקת עיבוד עברי
4. **בדיקת עיבוד טבלאות** - בדיקת זיהוי טבלאות
5. **בדיקה מלאה** - כל השלבים ברצף

## אינטגרציה עם המערכת הקיימת

המודול מיועד לאינטגרציה עם `js/core.js`:

```javascript
// ב-PDFConverterCore class
async extractTableFromOCR(page) {
    // ... קוד קיים ...
    
    // לפני OCR - הוסף עיבוד תמונה
    const imageProcessor = new ImageProcessor();
    
    // עיבוד מקדים
    const enhanced = imageProcessor.enhanceForOCR(canvas, {
        scale: 3.0,
        noiseReduction: true,
        contrastEnhancement: true,
        binaryThreshold: true,
        sharpen: true
    });
    
    // אופטימיזציה לעברית
    const hebrewOptimized = imageProcessor.optimizeForHebrew(enhanced);
    
    // עיבוד טבלאות
    const tableProcessed = imageProcessor.preprocessTable(hebrewOptimized);
    
    // השתמש ב-canvas המעובד לOCR
    const { data: { text } } = await this.tesseractWorker.recognize(tableProcessed, {
        lang: ocrLanguage
    });
    
    // ... המשך הקוד הקיים ...
}
```

## ביצועים ואופטימיזציה

### מדדי ביצועים צפויים
- **זמן עיבוד**: 2-5 שניות לעמוד A4 (תלוי ברזולוציה)
- **שיפור דיוק OCR**: 60-80% שיפור לקבצי פקס
- **זיכרון**: ~20-40MB לעמוד (זמני)

### טיפים לאופטימיזציה
1. **השתמש ב-scale מותאם** - 2.0-3.0 לרוב המקרים
2. **דלג על שלבים מיותרים** - אם התמונה כבר איכותית
3. **פעל בשלבים** - לבדיקה וdebug טובים יותר

## פתרון בעיות נפוצות

### שגיאת זיכרון
```
Error: Canvas allocation failed
```
**פתרון:** הקטן את פרמטר ה-scale או עבד בחלקים

### איכות OCR עדיין נמוכה
1. בדוק את איכות התמונה המקורית
2. נסה scale גבוה יותר (4.0-5.0)
3. הפעל את כל שלבי העיבוד ברצף
4. השתמש במצב debug לזיהוי בעיות

### עיבוד איטי
1. הקטן את ה-scale
2. דלג על שלבי עיבוד מיותרים
3. עבד קבצים קטנים יותר

## תמיכה טכנית

### דרישות מערכת
- דפדפן תומך HTML5 Canvas
- זיכרון RAM: מינימום 4GB מומלץ
- JavaScript enabled

### תאימות דפדפנים
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

### לוגים ו-Debug
```javascript
// הפעלת מצב debug
imageProcessor.setDebugMode(true);

// בדיקת לוגים בקונסולה
// [ImageProcessor] timestamp: message
```

## עדכונים עתידיים

### תכונות מתוכננות
- [ ] זיהוי אוטומטי של כיוון טקסט
- [ ] אלגוריתם מתקדם יותר לטבלאות
- [ ] תמיכה בשפות נוספות
- [ ] אופטימיזציה לביצועים

### הרחבות אפשריות
- [ ] ML-based image enhancement
- [ ] קטגוריזציה אוטומטית של תמונות
- [ ] זיהוי חתימות ולוגואים

---
*תיעוד עודכן: 23/05/2025 | גרסה: 1.0.0*
    const hebrewOptimized = imageProcessor.optimizeForHebrew(enhanced);
    
    // עיבוד טבלאות
    const tableProcessed = imageProcessor.preprocessTable(hebrewOptimized);
    
    // השתמש ב-canvas המעובד לOCR
    const { data: { text } } = await this.tesseractWorker.recognize(tableProcessed, {
        lang: ocrLanguage
    });
    
    // ... המשך הקוד הקיים ...
}
```

## ביצועים ואופטימיזציה

### מדדי ביצועים צפויים
- **זמן עיבוד**: 2-5 שניות לעמוד A4 (תלוי ברזולוציה)
- **שיפור דיוק OCR**: 60-80% שיפור לקבצי פקס
- **זיכרון**: ~20-40MB לעמוד (זמני)

### טיפים לאופטימיזציה
1. **השתמש ב-scale מותאם** - 2.0-3.0 לרוב המקרים
2. **דלג על שלבים מיותרים** - אם התמונה כבר איכותית
3. **פעל בשלבים** - לבדיקה וdebug טובים יותר

## פתרון בעיות נפוצות

### שגיאת זיכרון
```
Error: Canvas allocation failed
```
**פתרון:** הקטן את פרמטר ה-scale או עבד בחלקים

### איכות OCR עדיין נמוכה
1. בדוק את איכות התמונה המקורית
2. נסה scale גבוה יותר (4.0-5.0)
3. הפעל את כל שלבי העיבוד ברצף
4. השתמש במצב debug לזיהוי בעיות

### עיבוד איטי
1. הקטן את ה-scale
2. דלג על שלבי עיבוד מיותרים
3. עבד קבצים קטנים יותר

## תמיכה טכנית

### דרישות מערכת
- דפדפן תומך HTML5 Canvas
- זיכרון RAM: מינימום 4GB מומלץ
- JavaScript enabled

### תאימות דפדפנים
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

### לוגים ו-Debug
```javascript
// הפעלת מצב debug
imageProcessor.setDebugMode(true);

// בדיקת לוגים בקונסולה
// [ImageProcessor] timestamp: message
```

## עדכונים עתידיים

### תכונות מתוכננות
- [ ] זיהוי אוטומטי של כיוון טקסט
- [ ] אלגוריתם מתקדם יותר לטבלאות
- [ ] תמיכה בשפות נוספות
- [ ] אופטימיזציה לביצועים

### הרחבות אפשריות
- [ ] ML-based image enhancement
- [ ] קטגוריזציה אוטומטית של תמונות
- [ ] זיהוי חתימות ולוגואים

---
*תיעוד עודכן: 23/05/2025 | גרסה: 1.0.0*
