/**
 * Noah-Mina KYC Frontend Example
 *
 * Demonstrates the full KYC flow:
 * 1. Connect Auro Wallet
 * 2. Submit identity document (OCR simulated)
 * 3. Generate ZK age verification proof
 * 4. Register KYC on-chain
 * 5. View KYC status
 */
import { WalletConnect } from './components/WalletConnect';
import { KYCRegistration } from './components/KYCRegistration';
import { KYCProof } from './components/KYCProof';
import { KYCStatus } from './components/KYCStatus';
import { useNoahSDK } from './hooks/useNoahSDK';
import './styles.css';

function App() {
  const sdk = useNoahSDK();

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-icon">🛡️</span>
            <div>
              <h1 className="logo-title">Noah-Mina</h1>
              <p className="logo-subtitle">
                Privacy-Preserving KYC on Mina
              </p>
            </div>
          </div>
          <div className="header-badges">
            <span className="badge badge-mina">⚡ Mina Protocol</span>
            <span className="badge badge-zk">🔐 Zero Knowledge</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Error Banner */}
        {sdk.error && (
          <div className="error-banner">
            <span>⚠️ {sdk.error}</span>
            <button
              className="error-close"
              onClick={() => sdk.setError(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Flow Steps */}
        <div className="flow-container">
          {/* Step 1: Wallet */}
          <div className="step">
            <div className="step-number">
              <span
                className={
                  sdk.wallet.connected ? 'step-done' : 'step-active'
                }
              >
                {sdk.wallet.connected ? '✓' : '1'}
              </span>
            </div>
            <WalletConnect
              connected={sdk.wallet.connected}
              address={sdk.wallet.address}
              network={sdk.wallet.network}
              loading={sdk.loading}
              onConnect={sdk.connectWallet}
              onDisconnect={sdk.disconnectWallet}
            />
          </div>

          {/* Step 2: Registration */}
          {sdk.wallet.connected && (
            <div className="step">
              <div className="step-number">
                <span
                  className={sdk.credential ? 'step-done' : 'step-active'}
                >
                  {sdk.credential ? '✓' : '2'}
                </span>
              </div>
              <KYCRegistration
                credential={sdk.credential}
                loading={sdk.loading}
                onSubmit={sdk.requestAttestation}
              />
            </div>
          )}

          {/* Step 3: ZK Proof */}
          {sdk.wallet.connected && (
            <div className="step">
              <div className="step-number">
                <span
                  className={
                    sdk.kycStatus ? 'step-done' : sdk.credential ? 'step-active' : 'step-inactive'
                  }
                >
                  {sdk.kycStatus ? '✓' : '3'}
                </span>
              </div>
              <KYCProof
                credential={sdk.credential}
                presentation={sdk.presentation}
                loading={sdk.loading}
                onGenerateProof={sdk.generateAgeProof}
                onRegisterKYC={sdk.registerKYC}
              />
            </div>
          )}

          {/* Step 4: Status */}
          {sdk.wallet.connected && sdk.kycStatus && (
            <div className="step">
              <div className="step-number">
                <span className="step-done">✓</span>
              </div>
              <KYCStatus
                kycStatus={sdk.kycStatus}
                walletConnected={sdk.wallet.connected}
              />
            </div>
          )}
        </div>

        {/* How it Works */}
        <section className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <span className="step-emoji">🔗</span>
              <h3>Connect</h3>
              <p>Link your Auro wallet to identify yourself on Mina.</p>
            </div>
            <div className="step-card">
              <span className="step-emoji">📋</span>
              <h3>Attest</h3>
              <p>
                Submit your identity document. Our attester verifies and
                signs a credential using OCR.
              </p>
            </div>
            <div className="step-card">
              <span className="step-emoji">🔐</span>
              <h3>Prove</h3>
              <p>
                Generate a ZK proof in your browser. Your data never
                leaves your device.
              </p>
            </div>
            <div className="step-card">
              <span className="step-emoji">⛓️</span>
              <h3>Register</h3>
              <p>
                Store a privacy-preserving commitment on-chain. Verifiers
                see proof, not data.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>
          Built with{' '}
          <a
            href="https://github.com/zksecurity/mina-attestations"
            target="_blank"
            rel="noopener"
          >
            mina-attestations
          </a>{' '}
          +{' '}
          <a
            href="https://docs.minaprotocol.com/zkapps/o1js"
            target="_blank"
            rel="noopener"
          >
            o1js
          </a>
        </p>
        <p className="footer-sub">
          Noah-Mina SDK • Privacy-Preserving KYC
        </p>
      </footer>
    </div>
  );
}

export default App;
