/**
 * KYCRegistration — Document Upload + Attestation
 */
import { useState } from 'react';
import type { IdentityDocument } from '../hooks/useNoahSDK';

interface KYCRegistrationProps {
    credential: any;
    loading: boolean;
    onSubmit: (doc: IdentityDocument) => Promise<any>;
}

export function KYCRegistration({
    credential,
    loading,
    onSubmit,
}: KYCRegistrationProps) {
    const [form, setForm] = useState<IdentityDocument>({
        fullName: '',
        dateOfBirth: 0,
        nationality: '',
        documentType: 'passport',
        expiresAt: 0,
    });

    const [dobString, setDobString] = useState('');
    const [expiryString, setExpiryString] = useState('');

    const handleDateChange = (
        field: 'dateOfBirth' | 'expiresAt',
        value: string,
        setter: (v: string) => void
    ) => {
        setter(value);
        // Convert YYYY-MM-DD to YYYYMMDD number
        const numeric = parseInt(value.replace(/-/g, ''), 10);
        setForm((prev: IdentityDocument) => ({ ...prev, [field]: isNaN(numeric) ? 0 : numeric }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(form);
    };

    const isComplete =
        form.fullName.length >= 2 &&
        form.dateOfBirth > 19000101 &&
        form.nationality.length >= 2 &&
        form.expiresAt > 20240101;

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-icon">📋</span>
                <h2>KYC Registration</h2>
            </div>

            {credential ? (
                <div className="card-body">
                    <div className="success-box">
                        <span className="success-icon">✅</span>
                        <div>
                            <strong>Credential Issued!</strong>
                            <p>Your identity has been verified by the attester.</p>
                        </div>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Name</span>
                        <span className="info-value">{credential.data.fullName}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Issuer</span>
                        <span className="info-value mono">
                            {credential.issuer.slice(0, 16)}...
                        </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Issued</span>
                        <span className="info-value">
                            {new Date(credential.issuedAt).toLocaleString()}
                        </span>
                    </div>
                </div>
            ) : (
                <form className="card-body" onSubmit={handleSubmit}>
                    <p className="description">
                        Upload your identity document data. In production, this would use
                        OCR to extract passport fields automatically.
                    </p>

                    <div className="form-group">
                        <label htmlFor="fullName">Full Name</label>
                        <input
                            id="fullName"
                            type="text"
                            placeholder="Samuel Onah"
                            value={form.fullName}
                            onChange={(e) =>
                                setForm((prev: IdentityDocument) => ({ ...prev, fullName: e.target.value }))
                            }
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="dob">Date of Birth</label>
                            <input
                                id="dob"
                                type="date"
                                value={dobString}
                                onChange={(e) =>
                                    handleDateChange('dateOfBirth', e.target.value, setDobString)
                                }
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="expiry">Document Expiry</label>
                            <input
                                id="expiry"
                                type="date"
                                value={expiryString}
                                onChange={(e) =>
                                    handleDateChange('expiresAt', e.target.value, setExpiryString)
                                }
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="nationality">Nationality</label>
                            <select
                                id="nationality"
                                value={form.nationality}
                                onChange={(e) =>
                                    setForm((prev: IdentityDocument) => ({ ...prev, nationality: e.target.value }))
                                }
                            >
                                <option value="">Select...</option>
                                <option value="NG">🇳🇬 Nigeria</option>
                                <option value="US">🇺🇸 United States</option>
                                <option value="DE">🇩🇪 Germany</option>
                                <option value="GB">🇬🇧 United Kingdom</option>
                                <option value="JP">🇯🇵 Japan</option>
                                <option value="BR">🇧🇷 Brazil</option>
                                <option value="IN">🇮🇳 India</option>
                                <option value="KE">🇰🇪 Kenya</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="docType">Document Type</label>
                            <select
                                id="docType"
                                value={form.documentType}
                                onChange={(e) =>
                                    setForm((prev: IdentityDocument) => ({
                                        ...prev,
                                        documentType: e.target.value,
                                    }))
                                }
                            >
                                <option value="passport">🛂 Passport</option>
                                <option value="national_id">🪪 National ID</option>
                                <option value="drivers_license">🚗 Driver's License</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading || !isComplete}
                    >
                        {loading ? (
                            <span className="spinner" />
                        ) : (
                            <>📤 Submit for Attestation</>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
}
