// DOCX Fallback - Simple Word Document Creator
// js/exporters/docx-fallback.js

class SimpleDOCXExporter {
    constructor() {
        this.templates = {
            document: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <w:body>
        {CONTENT}
        <w:sectPr>
            <w:pgSz w:w="12240" w:h="15840"/>
            <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>
        </w:sectPr>
    </w:body>
</w:document>`,
            
            table: `<w:tbl>
    <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
    </w:tblPr>
    {ROWS}
</w:tbl>`,
            
            row: `<w:tr>{CELLS}</w:tr>`,
            
            cell: `<w:tc>
    <w:tcPr>
        <w:tcW w:w="2000" w:type="dxa"/>
    </w:tcPr>
    <w:p>
        <w:pPr>
            <w:bidi/>
            <w:jc w:val="right"/>
        </w:pPr>
        <w:r>
            <w:rPr>
                <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
                <w:sz w:val="24"/>
                <w:szCs w:val="24"/>
                <w:rtl/>
            </w:rPr>
            <w:t xml:space="preserve">{TEXT}</w:t>
        </w:r>
    </w:p>
</w:tc>`,
            
            paragraph: `<w:p>
    <w:pPr>
        <w:bidi/>
        <w:jc w:val="right"/>
    </w:pPr>
    <w:r>
        <w:rPr>
            <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
            <w:sz w:val="24"/>
            <w:szCs w:val="24"/>
            <w:rtl/>
        </w:rPr>
        <w:t xml:space="preserve">{TEXT}</w:t>
    </w:r>
</w:p>`
        };
    }

    createSimpleDOCX(data, options = {}) {
        const asTable = options.asTable !== false;
        let content = '';

        if (asTable && data.length > 0) {
            content = this.createTableContent(data);
        } else {
            content = this.createParagraphContent(data);
        }

        const documentXML = this.templates.document.replace('{CONTENT}', content);
        return this.createDOCXFile(documentXML);
    }

    createTableContent(data) {
        const rows = data.map(rowData => {
            const cells = rowData.map(cellData => 
                this.templates.cell.replace('{TEXT}', this.escapeXML(String(cellData || '')))
            ).join('');
            return this.templates.row.replace('{CELLS}', cells);
        }).join('');

        return this.templates.table.replace('{ROWS}', rows);
    }

    createParagraphContent(data) {
        return data.map(rowData => {
            const text = Array.isArray(rowData) ? rowData.join(' | ') : String(rowData);
            return this.templates.paragraph.replace('{TEXT}', this.escapeXML(text));
        }).join('');
    }

    escapeXML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    createDOCXFile(documentXML) {
        // יצירת קובץ DOCX פשוט עם JSZip
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library required for fallback DOCX export');
        }

        const zip = new JSZip();

        // תוכן בסיסי לקובץ DOCX
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

        zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

        zip.file('word/document.xml', documentXML);

        return zip.generateAsync({ type: 'blob' });
    }
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleDOCXExporter;
} else {
    window.SimpleDOCXExporter = SimpleDOCXExporter;
}