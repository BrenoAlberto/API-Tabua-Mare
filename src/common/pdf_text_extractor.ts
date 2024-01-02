import pdfParse from 'pdf-parse';

class PDFTextExtractor {
    constructor(
        private readonly pdfBuffer: Buffer
    ) { }

    async extractText() {
        try {
            const data = await pdfParse(this.pdfBuffer);
            return data.text;
        } catch (error) {
            console.error('Error extracting text from PDF:', error);
            throw error;
        }
    }
}

export {
    PDFTextExtractor
}
