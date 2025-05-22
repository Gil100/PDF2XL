# Demo and Testing Data

## Sample Hebrew Text for OCR Testing

### Basic Hebrew Text
```
שלום עולם
זהו טקסט לבדיקה
תוכנה להמרת PDF לאקסל
```

### Mixed Hebrew-English Content
```
Company Name: חברת הטכנולוגיה
Product: PDF Converter
Price: 100 ₪
Date: 2025-05-22
```

### Table-like Structure
```
שם הפריט          כמות    מחיר     סכום
מחשב נייד           2      3000     6000
עכבר אלחוטי         5       50      250
מקלדת עברית         3      150      450
                            סה"כ:    6700
```

### Address Format
```
רחוב הרצל 123
תל אביב, ישראל
מיקוד: 12345
טלפון: 03-1234567
```

## Testing Instructions

1. Create a simple PDF with the above Hebrew content
2. Use tools like:
   - Microsoft Word → Save as PDF
   - Google Docs → Download as PDF
   - LibreOffice → Export as PDF
3. Test the converter with these sample files
4. Verify Hebrew text recognition accuracy
5. Check table structure preservation

## Expected Results

The converter should:
- ✅ Recognize Hebrew characters correctly
- ✅ Maintain RTL text direction
- ✅ Preserve table structure
- ✅ Handle mixed Hebrew-English content
- ✅ Export numbers and dates properly

## Performance Benchmarks

- **Small PDF (1 page, text-only):** < 10 seconds
- **Medium PDF (5 pages, mixed content):** < 30 seconds  
- **Large PDF (10+ pages):** < 60 seconds
- **Scanned PDF (image-based):** < 90 seconds

Note: Processing times may vary based on:
- Device performance
- PDF complexity
- Internet speed (for OCR model download)
- Browser and available memory