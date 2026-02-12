/**
 * MRZScanner — Passport MRZ OCR Scanner
 *
 * Drag & drop or click to upload a passport photo.
 * Uses tesseract.js for OCR + mrz package for parsing.
 */
import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { parse as parseMRZ } from 'mrz';

export interface MRZData {
    firstName: string;
    lastName: string;
    fullName: string;
    dateOfBirth: number;    // YYYYMMDD
    nationality: string;
    documentNumber: string;
    documentType: string;
    expiresAt: number;      // YYYYMMDD
    sex: string;
    issuingState: string;
    raw: string;
}

interface MRZScannerProps {
    onScanComplete: (data: MRZData) => void;
    loading: boolean;
}

/** Convert MRZ date (YYMMDD) to YYYYMMDD */
function mrzDateToYYYYMMDD(dateStr: string, isBirth: boolean): number {
    if (!dateStr || dateStr.length < 6) return 0;

    const yy = parseInt(dateStr.substring(0, 2), 10);
    const mm = dateStr.substring(2, 4);
    const dd = dateStr.substring(4, 6);

    if (isNaN(yy)) return 0;

    // For birth dates, assume 1900s if > current 2-digit year, else 2000s
    // For expiry dates, always assume 2000s
    let yyyy: number;
    if (isBirth) {
        const currentYY = new Date().getFullYear() % 100;
        yyyy = yy > currentYY ? 1900 + yy : 2000 + yy;
    } else {
        yyyy = 2000 + yy;
    }

    const result = parseInt(`${yyyy}${mm}${dd}`, 10);
    return isNaN(result) ? 0 : result;
}

export function MRZScanner({ onScanComplete }: MRZScannerProps) {
    const [dragOver, setDragOver] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processImage = useCallback(
        async (file: File) => {
            setError(null);
            setScanning(true);
            setProgress(0);

            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(file);

            try {
                // Run Tesseract OCR
                const result = await Tesseract.recognize(file, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round((m.progress || 0) * 100));
                        }
                    },
                });

                const ocrText = result.data.text;

                // Try to find MRZ lines in the OCR output
                const lines = ocrText
                    .split('\n')
                    .map((l: string) => l.replace(/\s/g, '').trim())
                    .filter((l: string) => l.length >= 30);

                // MRZ is typically the last 2 lines for passports (TD3 format, 44 chars each)
                // or last 3 lines for ID cards (TD1 format, 30 chars each)
                let mrzLines: string[] = [];

                // Look for lines that look like MRZ (mostly uppercase + < + digits)
                const mrzPattern = /^[A-Z0-9<]{28,44}$/;
                const candidates = lines.filter((l: string) => mrzPattern.test(l));

                if (candidates.length >= 2) {
                    // Take the last 2 candidates (TD3 passport format)
                    mrzLines = candidates.slice(-2);
                } else if (candidates.length >= 3) {
                    mrzLines = candidates.slice(-3);
                }

                if (mrzLines.length < 2) {
                    throw new Error(
                        'Could not detect MRZ zone. Please ensure the passport MRZ area (bottom two lines of text) is clearly visible in the image.'
                    );
                }

                // Parse MRZ
                const mrzResult = parseMRZ(mrzLines.join('\n'));

                if (!mrzResult.valid && !mrzResult.fields) {
                    throw new Error(
                        'MRZ parsing failed. The scanned text may be unclear. Please try with a clearer image.'
                    );
                }

                const fields = mrzResult.fields;

                const data: MRZData = {
                    firstName: fields.firstName || '',
                    lastName: fields.lastName || '',
                    fullName: `${fields.firstName || ''} ${fields.lastName || ''}`.trim(),
                    dateOfBirth: fields.birthDate
                        ? mrzDateToYYYYMMDD(fields.birthDate, true)
                        : 0,
                    nationality: fields.nationality || fields.issuingState || '',
                    documentNumber: fields.documentNumber || '',
                    documentType: fields.documentCode?.startsWith('P')
                        ? 'passport'
                        : 'national_id',
                    expiresAt: fields.expirationDate
                        ? mrzDateToYYYYMMDD(fields.expirationDate, false)
                        : 0,
                    sex: fields.sex || '',
                    issuingState: fields.issuingState || '',
                    raw: mrzLines.join('\n'),
                };

                onScanComplete(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setScanning(false);
            }
        },
        [onScanComplete]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                processImage(file);
            } else {
                setError('Please upload an image file (JPG, PNG, etc.)');
            }
        },
        [processImage]
    );

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                processImage(file);
            }
        },
        [processImage]
    );

    return (
        <div className="mrz-scanner">
            {!preview ? (
                <div
                    className={`upload-zone ${dragOver ? 'upload-zone-active' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="upload-icon">🛂</div>
                    <h3 className="upload-title">Upload Passport Photo</h3>
                    <p className="upload-desc">
                        Drag & drop or click to scan the MRZ code. Your data is processed
                        locally and never leaves your device.
                    </p>
                    <button
                        className="btn btn-upload"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Upload Passport Photo
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                </div>
            ) : scanning ? (
                <div className="scan-progress">
                    <div className="scan-preview">
                        <img src={preview} alt="Passport" />
                        <div className="scan-overlay">
                            <div className="scan-line" />
                        </div>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="scan-status">
                        Scanning MRZ... {progress}%
                    </p>
                </div>
            ) : (
                <div className="scan-result">
                    <div className="scan-preview small">
                        <img src={preview} alt="Passport" />
                    </div>
                    {error && (
                        <div className="scan-error">
                            <p>⚠️ {error}</p>
                            <button
                                className="btn btn-retry"
                                onClick={() => {
                                    setPreview(null);
                                    setError(null);
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
