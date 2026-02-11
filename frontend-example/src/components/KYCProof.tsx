/**
 * KYCProof — Generate a ZK Presentation (Age Verification)
 */
import { useState } from 'react';

interface KYCProofProps {
    credential: any;
    presentation: any;
    loading: boolean;
    onGenerateProof: (minAge: number) => Promise<any>;
    onRegisterKYC: () => Promise<any>;
}

export function KYCProof({
    credential,
    presentation,
    loading,
    onGenerateProof,
    onRegisterKYC,
}: KYCProofProps) {
    const [minAge, setMinAge] = useState(18);

    if (!credential) {
        return (
            <div className="card card-disabled">
                <div className="card-header">
                    <span className="card-icon">🔐</span>
                    <h2>ZK Proof Generation</h2>
                </div>
                <div className="card-body">
                    <p className="description muted">
                        Complete KYC registration first to generate proofs.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-icon">🔐</span>
                <h2>ZK Proof Generation</h2>
            </div>

            <div className="card-body">
                {!presentation ? (
                    <>
                        <p className="description">
                            Generate a zero-knowledge proof that you meet the age requirement
                            — <strong>without revealing your date of birth</strong>.
                        </p>

                        <div className="form-group">
                            <label htmlFor="minAge">Minimum Age Requirement</label>
                            <div className="age-selector">
                                <input
                                    id="minAge"
                                    type="range"
                                    min={13}
                                    max={65}
                                    value={minAge}
                                    onChange={(e) => setMinAge(Number(e.target.value))}
                                />
                                <span className="age-display">{minAge}+</span>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-full"
                            onClick={() => onGenerateProof(minAge)}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : (
                                <>🧮 Generate Age Proof</>
                            )}
                        </button>

                        <p className="hint">
                            This proof runs entirely in your browser. Your personal data never
                            leaves your device.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="success-box">
                            <span className="success-icon">🎉</span>
                            <div>
                                <strong>ZK Proof Generated!</strong>
                                <p>
                                    You proved you are {minAge}+ without revealing your exact age.
                                </p>
                            </div>
                        </div>

                        <div className="info-row">
                            <span className="info-label">Proof Type</span>
                            <span className="badge badge-purple">
                                {presentation.type}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Proof Hash</span>
                            <span className="info-value mono">
                                {presentation.proofHash}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Generated</span>
                            <span className="info-value">
                                {new Date(presentation.generatedAt).toLocaleString()}
                            </span>
                        </div>

                        <button
                            className="btn btn-success btn-full"
                            onClick={onRegisterKYC}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : (
                                <>⛓️ Register KYC On-Chain</>
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
