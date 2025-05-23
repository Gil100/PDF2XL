# PDF to Excel/CSV/Word Converter with Hebrew OCR Support

A modern, client-side web application that converts PDF files to Excel (.xlsx), CSV, or Word (.docx) formats with full Hebrew language support and OCR capabilities.

# PDF to Excel/CSV/Word Converter with Hebrew OCR Support

A modern, client-side web application that converts PDF files to Excel (.xlsx), CSV, or Word (.docx) formats with full Hebrew language support and OCR capabilities.

## 🆕 Latest Updates (v2.2.0 - May 2025)

### ✅ Major DOCX Export Fixes:
- **🔧 DOCX Library Upgrade**: Updated to modern docx@8.5.0 with CDN reliability
- **🔤 Hebrew Encoding Fix**: Resolved gibberish text issues in Hebrew content
- **📄 Real DOCX Files**: Now generates proper Word documents that open correctly
- **⚡ Smart Fallback**: Automatic RTF fallback when main library unavailable
- **🛡️ Error Resilience**: Enhanced error handling with detailed debugging

### 🎯 Performance Improvements:
- Faster initialization with timeout mechanisms
- Better console logging for troubleshooting
- Improved mixed-language text support (Hebrew + English)
- Enhanced character encoding detection and correction

### 🐛 Previous Updates (v2.1.0):
- **🛠️ Fixed Error Display**: No more error messages before file selection
- **📄 Enhanced DOCX Export**: Improved Word document generation with better column structure
- **📂 Local DOCX Library**: Added local copy of docx.js for reliable functionality
- **📊 Better Table Structure**: Improved table formatting in DOCX exports
- **🌐 Increased Reliability**: Better error handling and fallback mechanisms

## 🌟 Features

### Core Functionality
- **PDF to Excel/CSV/Word Conversion**: Convert PDF files to structured spreadsheet or document formats
- **Hebrew OCR Support**: Advanced OCR with right-to-left (RTL) text recognition
- **Batch Processing**: Process multiple PDF files simultaneously
- **Live Preview**: Preview converted data before downloading
- **Data Validation**: Automatic validation with detailed reports

### Technical Features
- **Client-Side Only**: No server required - works entirely in the browser
- **GitHub Pages Ready**: Deploy directly to GitHub Pages
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Bootstrap-based interface with Hebrew RTL support
- **Progress Tracking**: Real-time progress indicators during processing

### Supported Formats
- **Input**: PDF files (text-based and image-based)
- **Output**: Excel (.xlsx), CSV (.csv), and Word (.docx)
- **Languages**: Hebrew, English, and mixed content

## 🚀 Quick Start

### Option 1: Direct Use
1. Download all files to a folder
2. Open `index.html` in a modern web browser
3. Start converting PDFs!

### Option 2: GitHub Pages Deployment
1. Fork or clone this repository
2. Enable GitHub Pages in repository settings
3. Access your live application at `https://yourusername.github.io/PDF2XL`

## 📁 Project Structure

```
PDF2XL/
├── index.html              # Main application file
├── styles.css              # Custom styling and RTL support
├── script.js               # Legacy core functionality
├── js/                     # Enhanced modular structure
│   ├── core.js             # Core application logic
│   ├── libs/               # Local libraries
│   │   └── docx.js         # Local copy of DOCX library
│   └── exporters/          # Export modules
│       ├── base-exporter.js    # Base exporter class
│       ├── excel-exporter.js   # Excel export functionality
│       ├── csv-exporter.js     # CSV export functionality
│       └── docx-exporter.js    # DOCX export functionality
└── README.md               # This documentation
```

## 🛠️ Technologies Used

### Libraries
- **PDF.js v3.11.174**: PDF parsing and rendering (CDN)
- **Tesseract.js v4.1.1**: OCR with Hebrew language support (CDN)
- **SheetJS v0.18.5**: Excel file generation (CDN)
- **DocX v8.5.0**: Word document generation with RTL support (CDN with fallback)
- **Bootstrap v5.3.2**: UI framework with RTL support (CDN)
- **Font Awesome v6.4.0**: Icons (CDN)

### Browser Requirements
- Modern browsers with ES6+ support
- Recommended: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

## 📖 How to Use

### Single File Conversion
1. **Upload**: Drag & drop a PDF file or click "בחר קובץ"
2. **Configure**: Select output format (Excel/CSV) and OCR language
3. **Process**: Click "התחל עיבוד" to start conversion
4. **Preview**: Review the extracted data in the preview table
5. **Download**: Click "הורד קובץ" to save the result

### Batch Processing
1. **Upload Multiple**: Use the batch upload area for multiple PDFs
2. **Monitor Progress**: Track individual file processing status
3. **Download All**: Use "הורד הכל כ-ZIP" for bulk download

### Advanced Options
- **OCR Language**: Choose Hebrew, English, or mixed
- **Preserve Formatting**: Maintain table structure from PDF
- **Data Validation**: Enable automatic data quality checks

## 🔧 Customization

### Modifying OCR Settings
Edit `script.js` to customize Tesseract OCR parameters:

```javascript
// In initializeTesseract() method
this.tesseractWorker = await Tesseract.createWorker('heb+eng', 1, {
    logger: (info) => { /* custom logging */ },
    // Add custom OCR parameters here
});
```

### Styling Customization
Modify `styles.css` for visual changes:
- Color scheme in CSS variables
- Layout adjustments for different screen sizes
- RTL/LTR text direction settings

### Adding New Languages
To add OCR support for additional languages:
1. Update the language dropdown in `index.html`
2. Modify the OCR initialization in `script.js`
3. Ensure Tesseract.js supports the target language

## 🔧 Troubleshooting

### Common Issues:

**DOCX Export Problems:**
- **Fixed in v2.2.0**: Upgraded to modern DOCX library with automatic fallback
- Files now generate as proper DOCX format that opens correctly in Microsoft Word
- Hebrew text encoding issues have been resolved
- If files still don't open, check that you have Microsoft Word or LibreOffice installed
- For troubleshooting, check browser console for detailed error messages

**OCR Not Working:**
- Ensure stable internet connection for initial Tesseract download
- Check browser console for error messages
- Try refreshing the page to reinitialize OCR

**Poor Recognition Quality**
- Use high-quality PDF files
- Ensure good contrast in scanned documents
- Try different OCR language settings

**Download Issues**
- Check browser's download settings
- Ensure popup blockers are disabled
- Try different output formats

**Memory Issues with Large Files**
- Process files individually instead of batch mode
- Use smaller PDF files (< 10MB recommended)
- Close other browser tabs to free memory

### Browser Console Debugging
Open browser Developer Tools (F12) and check the Console tab for detailed error messages.

## 🚀 Deployment Options

### GitHub Pages
1. Create a new repository on GitHub
2. Upload all project files
3. Go to Settings → Pages
4. Select source branch (usually `main`)
5. Access at `https://yourusername.github.io/repositoryname`

### Netlify
1. Create account at netlify.com
2. Drag & drop the project folder
3. Get instant deployment URL

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Follow deployment prompts

### Local Development Server
For testing with a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js (with serve package)
npx serve .

# PHP
php -S localhost:8000
```

## 📊 Performance Optimization

### For Large Files
- Enable "Preserve Formatting" only when needed
- Process files individually rather than in batch
- Use lower OCR quality settings for faster processing

### For Better Accuracy
- Use high-resolution PDFs
- Enable data validation
- Select appropriate OCR language combinations

## 🔒 Privacy & Security

- **Client-Side Processing**: All files are processed locally in your browser
- **No Data Upload**: Files never leave your device
- **No Server Required**: No backend infrastructure needed
- **HTTPS Ready**: Secure deployment on GitHub Pages/Netlify

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines
- Maintain Hebrew RTL support
- Test with various PDF types
- Ensure mobile responsiveness
- Follow existing code style

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Create an issue in the GitHub repository
4. Include sample PDF files when reporting problems

## 🔮 Future Enhancements

- [ ] Additional OCR languages
- [ ] Advanced table detection algorithms
- [ ] PDF password support
- [ ] Export to additional formats (JSON, XML)
- [ ] Cloud storage integration
- [ ] Advanced data cleaning options

---

**Built with ❤️ for the Hebrew-speaking community**

*Last updated: May 2025 - v2.2.0 with major DOCX improvements*