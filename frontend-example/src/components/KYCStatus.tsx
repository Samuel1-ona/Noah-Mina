/**
 * KYCStatus — Display On-Chain KYC Status
 */
interface KYCStatusProps {
    kycStatus: {
        commitment: string;
        issuerHash: string;
        registeredAt: string;
        isActive: boolean;
    } | null;
    walletConnected: boolean;
}

export function KYCStatus({ kycStatus, walletConnected }: KYCStatusProps) {
    if (!walletConnected) {
        return null;
    }

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-icon">📊</span>
                <h2>KYC Status</h2>
            </div>

            <div className="card-body">
                {!kycStatus ? (
                    <div className="status-box status-pending">
                        <div className="status-indicator">
                            <span className="status-dot dot-yellow" />
                            <span>No KYC Record</span>
                        </div>
                        <p className="description muted">
                            Complete the registration flow to register your KYC on-chain.
                        </p>
                    </div>
                ) : (
                    <>
                        <div
                            className={`status-box ${kycStatus.isActive ? 'status-active' : 'status-revoked'
                                }`}
                        >
                            <div className="status-indicator">
                                <span
                                    className={`status-dot ${kycStatus.isActive ? 'dot-green' : 'dot-red'
                                        }`}
                                />
                                <span>
                                    {kycStatus.isActive ? 'KYC Active' : 'KYC Revoked'}
                                </span>
                            </div>
                        </div>

                        <div className="info-row">
                            <span className="info-label">Commitment</span>
                            <span className="info-value mono">
                                {kycStatus.commitment}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Issuer</span>
                            <span className="info-value mono">
                                {kycStatus.issuerHash.slice(0, 16)}...
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Registered</span>
                            <span className="info-value">
                                {new Date(kycStatus.registeredAt).toLocaleString()}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
