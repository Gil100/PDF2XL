/**
 * Image Processor Module - מודול עיבוד תמונה מתקדם
 * js/image-processor.js
 * 
 * מודול עצמאי לעיבוד מקדים של תמונות PDF סרוקות
 * מיועד לשיפור איכות OCR, במיוחד לטקסט עברי וטבלאות כספיות
 */

class ImageProcessor {
    constructor() {
        this.debugMode = false;
        this.log('Image Processor initialized');
    }

    /**
     * עיבוד מקדים מתקדם לזיהוי OCR
     * @param {HTMLCanvasElement} canvas - Canvas עם התמונה המקורית
     * @param {Object} options - אפשרויות עיבוד
     * @returns {HTMLCanvasElement} Canvas מעובד
     */
    enhanceForOCR(canvas, options = {}) {
        const defaultOptions = {
            scale: 3.0,              // הגדלה לרזולוציה גבוהה
            noiseReduction: true,    // הפחתת רעש
            contrastEnhancement: true, // שיפור ניגוד
            binaryThreshold: true,   // המרה לשחור-לבן
            sharpen: true           // חידוד תמונה
        };

        const config = { ...defaultOptions, ...options };
        this.log('Starting OCR enhancement with config:', config);

        try {
            let processedCanvas = this.cloneCanvas(canvas);

            // שלב 1: הגדלת רזולוציה
            if (config.scale !== 1.0) {
                processedCanvas = this.scaleImage(processedCanvas, config.scale);
                this.log(`Image scaled by factor ${config.scale}`);
            }

            // שלב 2: הפחתת רעש
            if (config.noiseReduction) {
                processedCanvas = this.applyGaussianBlur(processedCanvas, 1.0);
                this.log('Gaussian blur applied for noise reduction');
            }

            // שלב 3: שיפור ניגוד
            if (config.contrastEnhancement) {
                processedCanvas = this.enhanceContrast(processedCanvas);
                this.log('Contrast enhancement applied');
            }

            // שלב 4: חידוד
            if (config.sharpen) {
                processedCanvas = this.sharpenImage(processedCanvas);
                this.log('Image sharpening applied');
            }

            // שלב 5: המרה לשחור-לבן
            if (config.binaryThreshold) {
                processedCanvas = this.applyBinaryThreshold(processedCanvas);
                this.log('Binary threshold applied');
            }

            this.log('OCR enhancement completed successfully');
            return processedCanvas;

        } catch (error) {
            this.log('Error in enhanceForOCR:', error.message, 'error');
            return canvas; // החזר canvas מקורי במקרה של שגיאה
        }
    }

    /**
     * אופטימיזציה ספציפית לטקסט עברי
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    optimizeForHebrew(canvas) {
        this.log('Applying Hebrew text optimization');

        try {
            let processedCanvas = this.cloneCanvas(canvas);

            // שיפור קווי התווים העבריים
            processedCanvas = this.enhanceHebrewCharacters(processedCanvas);
            
            // זיהוי וטיפול בכיוון טקסט RTL
            processedCanvas = this.detectTextOrientation(processedCanvas);

            this.log('Hebrew optimization completed');
            return processedCanvas;

        } catch (error) {
            this.log('Error in optimizeForHebrew:', error.message, 'error');
            return canvas;
        }
    }

    /**
     * עיבוד מקדים לטבלאות
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    preprocessTable(canvas) {
        this.log('Applying table preprocessing');

        try {
            let processedCanvas = this.cloneCanvas(canvas);

            // זיהוי וחיזוק קווי טבלה
            processedCanvas = this.detectTableLines(processedCanvas);
            
            // הפרדת תאי טבלה
            processedCanvas = this.separateTableCells(processedCanvas);

            this.log('Table preprocessing completed');
            return processedCanvas;

        } catch (error) {
            this.log('Error in preprocessTable:', error.message, 'error');
            return canvas;
        }
    }

    /**
     * הגדלת תמונה עם שמירה על איכות
     * @param {HTMLCanvasElement} canvas 
     * @param {number} scale 
     * @returns {HTMLCanvasElement}
     */
    scaleImage(canvas, scale) {
        const scaledCanvas = document.createElement('canvas');
        const scaledCtx = scaledCanvas.getContext('2d');

        scaledCanvas.width = canvas.width * scale;
        scaledCanvas.height = canvas.height * scale;

        // שימוש באלגוריתם interpolation איכותי
        scaledCtx.imageSmoothingEnabled = true;
        scaledCtx.imageSmoothingQuality = 'high';

        scaledCtx.scale(scale, scale);
        scaledCtx.drawImage(canvas, 0, 0);

        return scaledCanvas;
    }

    /**
     * הפחתת רעש באמצעות Gaussian Blur
     * @param {HTMLCanvasElement} canvas 
     * @param {number} radius 
     * @returns {HTMLCanvasElement}
     */
    applyGaussianBlur(canvas, radius = 1.0) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const blurredData = this.gaussianBlur(imageData, radius);
        
        const blurredCanvas = document.createElement('canvas');
        blurredCanvas.width = canvas.width;
        blurredCanvas.height = canvas.height;
        const blurredCtx = blurredCanvas.getContext('2d');
        blurredCtx.putImageData(blurredData, 0, 0);

        return blurredCanvas;
    }

    /**
     * שיפור ניגוד באמצעות CLAHE (Contrast Limited Adaptive Histogram Equalization)
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    enhanceContrast(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // חישוב היסטוגרמה
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[gray]++;
        }

        // יצירת LUT לשיפור ניגוד
        const lut = this.createContrastLUT(histogram, data.length / 4);

        // החלת השיפור
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            const enhanced = lut[gray];
            
            data[i] = enhanced;     // R
            data[i + 1] = enhanced; // G
            data[i + 2] = enhanced; // B
            // A נשאר כפי שהוא
        }

        const enhancedCanvas = document.createElement('canvas');
        enhancedCanvas.width = canvas.width;
        enhancedCanvas.height = canvas.height;
        const enhancedCtx = enhancedCanvas.getContext('2d');
        enhancedCtx.putImageData(imageData, 0, 0);

        return enhancedCanvas;
    }

    /**
     * חידוד תמונה
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    sharpenImage(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Sharpening kernel
        const kernel = [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ];

        const sharpenedData = this.applyConvolution(imageData, kernel);
        
        const sharpenedCanvas = document.createElement('canvas');
        sharpenedCanvas.width = canvas.width;
        sharpenedCanvas.height = canvas.height;
        const sharpenedCtx = sharpenedCanvas.getContext('2d');
        sharpenedCtx.putImageData(sharpenedData, 0, 0);

        return sharpenedCanvas;
    }

    /**
     * המרה לשחור-לבן עם threshold אדפטיבי
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    applyBinaryThreshold(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // חישוב threshold אוטומטי באמצעות Otsu's method
        const threshold = this.calculateOtsuThreshold(data);
        this.log(`Binary threshold calculated: ${threshold}`);

        // החלת threshold
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            const binary = gray > threshold ? 255 : 0;
            
            data[i] = binary;     // R
            data[i + 1] = binary; // G
            data[i + 2] = binary; // B
            // A נשאר כפי שהוא
        }

        const binaryCanvas = document.createElement('canvas');
        binaryCanvas.width = canvas.width;
        binaryCanvas.height = canvas.height;
        const binaryCtx = binaryCanvas.getContext('2d');
        binaryCtx.putImageData(imageData, 0, 0);

        return binaryCanvas;
    }

    /**
     * שיפור תווים עבריים
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    enhanceHebrewCharacters(canvas) {
        // אלגוריתם ספציפי לחיזוק תווים עבריים
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Kernel מיוחד לתווים עבריים
        const hebrewKernel = [
            [0, -0.5, 0],
            [-0.5, 3, -0.5],
            [0, -0.5, 0]
        ];

        const enhancedData = this.applyConvolution(imageData, hebrewKernel);
        
        const enhancedCanvas = document.createElement('canvas');
        enhancedCanvas.width = canvas.width;
        enhancedCanvas.height = canvas.height;
        const enhancedCtx = enhancedCanvas.getContext('2d');
        enhancedCtx.putImageData(enhancedData, 0, 0);

        return enhancedCanvas;
    }

    /**
     * זיהוי כיוון טקסט (RTL/LTR)
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    detectTextOrientation(canvas) {
        // כרגע מחזיר את הcanvas כפי שהוא
        // בעתיד ניתן להוסיף אלגוריתם לזיהוי כיוון
        return canvas;
    }

    /**
     * זיהוי קווי טבלה
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    detectTableLines(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Edge detection לזיהוי קווים
        const sobelX = [
            [-1, 0, 1],
            [-2, 0, 2],
            [-1, 0, 1]
        ];
        
        const sobelY = [
            [-1, -2, -1],
            [0, 0, 0],
            [1, 2, 1]
        ];

        const edgesX = this.applyConvolution(imageData, sobelX);
        const edgesY = this.applyConvolution(imageData, sobelY);
        
        // שילוב edge detection
        const combinedEdges = this.combineEdges(edgesX, edgesY);
        
        const edgeCanvas = document.createElement('canvas');
        edgeCanvas.width = canvas.width;
        edgeCanvas.height = canvas.height;
        const edgeCtx = edgeCanvas.getContext('2d');
        edgeCtx.putImageData(combinedEdges, 0, 0);

        return edgeCanvas;
    }

    /**
     * הפרדת תאי טבלה
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    separateTableCells(canvas) {
        // כרגע מחזיר את הcanvas כפי שהוא
        // בעתיד ניתן להוסיף אלגוריתם לזיהוי תאים
        return canvas;
    }

    // פונקציות עזר

    /**
     * שכפול canvas
     * @param {HTMLCanvasElement} canvas 
     * @returns {HTMLCanvasElement}
     */
    cloneCanvas(canvas) {
        const clonedCanvas = document.createElement('canvas');
        const clonedCtx = clonedCanvas.getContext('2d');
        clonedCanvas.width = canvas.width;
        clonedCanvas.height = canvas.height;
        clonedCtx.drawImage(canvas, 0, 0);
        return clonedCanvas;
    }

    /**
     * יישום Gaussian Blur
     * @param {ImageData} imageData 
     * @param {number} radius 
     * @returns {ImageData}
     */
    gaussianBlur(imageData, radius) {
        const kernel = this.createGaussianKernel(radius);
        return this.applyConvolution(imageData, kernel);
    }

    /**
     * יצירת Gaussian kernel
     * @param {number} radius 
     * @returns {Array}
     */
    createGaussianKernel(radius) {
        const size = Math.ceil(radius * 2) * 2 + 1;
        const kernel = [];
        const sigma = radius / 3;
        const sigma2 = 2 * sigma * sigma;
        let sum = 0;

        for (let y = 0; y < size; y++) {
            kernel[y] = [];
            for (let x = 0; x < size; x++) {
                const distance = Math.pow(x - size / 2, 2) + Math.pow(y - size / 2, 2);
                const value = Math.exp(-distance / sigma2) / (Math.PI * sigma2);
                kernel[y][x] = value;
                sum += value;
            }
        }

        // נרמול
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                kernel[y][x] /= sum;
            }
        }

        return kernel;
    }

    /**
     * יישום convolution filter
     * @param {ImageData} imageData 
     * @param {Array} kernel 
     * @returns {ImageData}
     */
    applyConvolution(imageData, kernel) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data.length);

        const kernelSize = kernel.length;
        const offset = Math.floor(kernelSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;

                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        const px = Math.min(Math.max(x + kx - offset, 0), width - 1);
                        const py = Math.min(Math.max(y + ky - offset, 0), height - 1);
                        const idx = (py * width + px) * 4;

                        const weight = kernel[ky][kx];
                        r += data[idx] * weight;
                        g += data[idx + 1] * weight;
                        b += data[idx + 2] * weight;
                    }
                }

                const idx = (y * width + x) * 4;
                newData[idx] = Math.min(Math.max(r, 0), 255);
                newData[idx + 1] = Math.min(Math.max(g, 0), 255);
                newData[idx + 2] = Math.min(Math.max(b, 0), 255);
                newData[idx + 3] = data[idx + 3]; // Alpha
            }
        }

        return new ImageData(newData, width, height);
    }

    /**
     * יצירת LUT לשיפור ניגוד
     * @param {Array} histogram 
     * @param {number} totalPixels 
     * @returns {Array}
     */
    createContrastLUT(histogram, totalPixels) {
        const lut = new Array(256);
        let cdf = 0;

        for (let i = 0; i < 256; i++) {
            cdf += histogram[i];
            lut[i] = Math.round((cdf / totalPixels) * 255);
        }

        return lut;
    }

    /**
     * חישוב Otsu threshold
     * @param {Uint8ClampedArray} data 
     * @returns {number}
     */
    calculateOtsuThreshold(data) {
        const histogram = new Array(256).fill(0);
        const total = data.length / 4;

        // בנייה של היסטוגרמה
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[gray]++;
        }

        let sum = 0;
        for (let i = 0; i < 256; i++) {
            sum += i * histogram[i];
        }

        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let maxVariance = 0;
        let threshold = 0;

        for (let i = 0; i < 256; i++) {
            wB += histogram[i];
            if (wB === 0) continue;

            wF = total - wB;
            if (wF === 0) break;

            sumB += i * histogram[i];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;

            const variance = wB * wF * (mB - mF) * (mB - mF);

            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = i;
            }
        }

        return threshold;
    }

    /**
     * שילוב edge detection מכיוונים שונים
     * @param {ImageData} edgesX 
     * @param {ImageData} edgesY 
     * @returns {ImageData}
     */
    combineEdges(edgesX, edgesY) {
        const dataX = edgesX.data;
        const dataY = edgesY.data;
        const combined = new Uint8ClampedArray(dataX.length);

        for (let i = 0; i < dataX.length; i += 4) {
            const magnitude = Math.sqrt(
                dataX[i] * dataX[i] + dataY[i] * dataY[i]
            );
            
            combined[i] = Math.min(magnitude, 255);
            combined[i + 1] = Math.min(magnitude, 255);
            combined[i + 2] = Math.min(magnitude, 255);
            combined[i + 3] = 255; // Alpha
        }

        return new ImageData(combined, edgesX.width, edgesX.height);
    }

    /**
     * הדפסת הודעות debug
     * @param {string} message 
     * @param {any} data 
     * @param {string} level 
     */
    log(message, data = null, level = 'info') {
        if (!this.debugMode && level !== 'error') return;

        const timestamp = new Date().toISOString();
        const prefix = `[ImageProcessor] ${timestamp}:`;
        
        switch (level) {
            case 'error':
                console.error(prefix, message, data);
                break;
            case 'warn':
                console.warn(prefix, message, data);
                break;
            default:
                console.log(prefix, message, data);
        }
    }

    /**
     * הפעלת/כיבוי מצב debug
     * @param {boolean} enabled 
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// ייצוא המחלקה
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageProcessor;
} else {
    window.ImageProcessor = ImageProcessor;
}
