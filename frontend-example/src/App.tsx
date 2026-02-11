/**
 * Noah-Mina — Privacy-Preserving KYC
 *
 * 5-Step Flow:
 * 1. Scan — Upload passport → MRZ OCR
 * 2. Witness — Attester verifies & signs credential
 * 3. Proof — Generate ZK proof client-side
 * 4. Submit — Register KYC commitment on-chain
 * 5. Verified — Address bound to KYC ✓
 */
import { useNoahSDK, STEPS } from './hooks/useNoahSDK';
import { MRZScanner } from './components/MRZScanner';
import './styles.css';

function App() {
  const sdk = useNoahSDK();

  const renderStepContent = () => {
    // If not connected, show connect prompt
    if (!sdk.wallet.connected) {
      return (
        <div className="step-content connect-content">
          <div className="connect-icon">🔗</div>
          <h2>Connect Your Wallet</h2>
          <p>Connect your Auro wallet to begin the KYC verification process.</p>
          <button
            className="btn btn-primary"
            onClick={sdk.connectWallet}
            disabled={sdk.loading}
          >
            {sdk.loading ? <span className="spinner" /> : '🦊 Connect Auro Wallet'}
          </button>
        </div>
      );
    }

    switch (sdk.currentStep) {
      case 'scan':
        return (
          <div className="step-content">
            <MRZScanner
              onScanComplete={sdk.onMRZScanned}
              loading={sdk.loading}
            />
          </div>
        );

      case 'witness':
        return (
          <div className="step-content">
            <div className="witness-card">
              <div className="witness-header">
                <span className="witness-icon">✅</span>
                <h3>MRZ Scanned Successfully</h3>
              </div>
              {sdk.mrzData && (
                <div className="extracted-fields">
                  <div className="field-row">
                    <span className="field-label">Full Name</span>
                    <span className="field-value">{sdk.mrzData.fullName}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Date of Birth</span>
                    <span className="field-value">
                      {String(sdk.mrzData.dateOfBirth).replace(
                        /(\d{4})(\d{2})(\d{2})/,
                        '$1-$2-$3'
                      )}
                    </span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Nationality</span>
                    <span className="field-value">{sdk.mrzData.nationality}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Document No.</span>
                    <span className="field-value mono">{sdk.mrzData.documentNumber}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Expires</span>
                    <span className="field-value">
                      {String(sdk.mrzData.expiresAt).replace(
                        /(\d{4})(\d{2})(\d{2})/,
                        '$1-$2-$3'
                      )}
                    </span>
                  </div>
                </div>
              )}
              <p className="witness-note">
                This data will be sent to a trusted attester for verification.
                The attester will sign a credential without storing your data.
              </p>
              <button
                className="btn btn-primary full-width"
                onClick={sdk.submitForAttestation}
                disabled={sdk.loading}
              >
                {sdk.loading ? (
                  <span className="spinner" />
                ) : (
                  '📤 Submit to Attester'
                )}
              </button>
            </div>
          </div>
        );

      case 'proof':
        return (
          <div className="step-content">
            <div className="proof-card">
              <div className="proof-icon">🔐</div>
              <h3>Generate Zero-Knowledge Proof</h3>
              <p>
                Your proof runs <strong>entirely in your browser</strong>.
                It proves you meet the requirements without revealing your personal data.
              </p>
              <div className="proof-claims">
                <div className="claim-badge">✓ Age ≥ 18</div>
                <div className="claim-badge">✓ Valid Document</div>
                <div className="claim-badge">✓ Not Expired</div>
              </div>
              <button
                className="btn btn-primary full-width"
                onClick={sdk.generateProof}
                disabled={sdk.loading}
              >
                {sdk.loading ? (
                  <span className="spinner" />
                ) : (
                  '🧮 Generate ZK Proof'
                )}
              </button>
              <p className="privacy-note">
                🛡️ Your identity data never leaves your device
              </p>
            </div>
          </div>
        );

      case 'submit':
        return (
          <div className="step-content">
            <div className="submit-card">
              <div className="submit-icon">⛓️</div>
              <h3>Register KYC On-Chain</h3>
              <p>
                Store a privacy-preserving commitment on Mina. Verifiers can
                check your KYC status without seeing your data.
              </p>
              {sdk.presentation && (
                <div className="proof-details">
                  <div className="field-row">
                    <span className="field-label">Proof Hash</span>
                    <span className="field-value mono">
                      {sdk.presentation.proofHash.slice(0, 18)}...
                    </span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Proof Type</span>
                    <span className="field-value tag">Age Verification</span>
                  </div>
                </div>
              )}
              <button
                className="btn btn-success full-width"
                onClick={sdk.registerOnChain}
                disabled={sdk.loading}
              >
                {sdk.loading ? (
                  <span className="spinner" />
                ) : (
                  '⛓️ Register on Mina'
                )}
              </button>
            </div>
          </div>
        );

      case 'verified':
        return (
          <div className="step-content">
            <div className="verified-card">
              <div className="verified-icon">🎉</div>
              <h3>KYC Verified</h3>
              <p>Your address is now bound to a valid KYC record on Mina.</p>
              {sdk.kycRecord && (
                <div className="kyc-details">
                  <div className="field-row">
                    <span className="field-label">Status</span>
                    <span className="field-value">
                      <span className="status-dot active" />
                      Active
                    </span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Address</span>
                    <span className="field-value mono">
                      {sdk.wallet.address?.slice(0, 10)}...{sdk.wallet.address?.slice(-6)}
                    </span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Commitment</span>
                    <span className="field-value mono">
                      {sdk.kycRecord.commitment.slice(0, 18)}...
                    </span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Registered</span>
                    <span className="field-value">
                      {new Date(sdk.kycRecord.registeredAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              <div className="bool-result">
                <span className="bool-label">hasKYC(address)</span>
                <span className="bool-value true">→ true</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🛡️</span>
            <span className="logo-text">Noah</span>
          </div>
        </div>
        <div className="header-right">
          {sdk.wallet.connected ? (
            <button className="btn btn-wallet connected" onClick={sdk.disconnectWallet}>
              <span className="wallet-dot" />
              {sdk.wallet.address?.slice(0, 6)}...{sdk.wallet.address?.slice(-4)}
            </button>
          ) : (
            <button
              className="btn btn-wallet"
              onClick={sdk.connectWallet}
              disabled={sdk.loading}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {sdk.error && (
        <div className="error-banner">
          <span>⚠️ {sdk.error}</span>
          <button onClick={() => sdk.setError(null)}>✕</button>
        </div>
      )}

      {/* Main */}
      <main className="main">
        {/* Stepper */}
        {sdk.wallet.connected && (
          <div className="stepper">
            {STEPS.map((step, i) => {
              const isActive = step.id === sdk.currentStep;
              const isDone = i < sdk.currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={`stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                >
                  <div className="stepper-dot">
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className="stepper-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Card */}
        <div className="card-container">
          <div className="main-card">{renderStepContent()}</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>
          Powered by{' '}
          <a href="https://github.com/zksecurity/mina-attestations" target="_blank" rel="noopener">
            Zksecurity
          </a>{' '}
          &amp;{' '}
          <a href="https://docs.minaprotocol.com/zkapps/o1js" target="_blank" rel="noopener">
            Mina o1js
          </a>{' '}
          • Zero Knowledge Identity Layer
        </p>
      </footer>
    </div>
  );
}

export default App;
