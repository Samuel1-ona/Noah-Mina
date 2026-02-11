/**
 * WalletConnect — Connect Auro Wallet
 */
import '../styles.css';

interface WalletConnectProps {
    connected: boolean;
    address: string | null;
    network: string | null;
    loading: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
}

export function WalletConnect({
    connected,
    address,
    network,
    loading,
    onConnect,
    onDisconnect,
}: WalletConnectProps) {
    const truncate = (addr: string) =>
        `${addr.slice(0, 8)}...${addr.slice(-6)}`;

    return (
        <div className="card wallet-card">
            <div className="card-header">
                <span className="card-icon">🔗</span>
                <h2>Wallet Connection</h2>
            </div>

            {!connected ? (
                <div className="card-body">
                    <p className="description">
                        Connect your Auro wallet to begin the KYC process.
                    </p>
                    <button
                        className="btn btn-primary btn-full"
                        onClick={onConnect}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="spinner" />
                        ) : (
                            <>
                                <span>🦊</span> Connect Auro Wallet
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="card-body">
                    <div className="info-row">
                        <span className="info-label">Address</span>
                        <span className="info-value mono">{truncate(address!)}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Network</span>
                        <span className="badge badge-success">{network}</span>
                    </div>
                    <button
                        className="btn btn-outline btn-full"
                        onClick={onDisconnect}
                    >
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    );
}
