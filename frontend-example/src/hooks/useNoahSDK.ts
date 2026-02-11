/**
 * useNoahSDK — React Hook wrapping the Noah-Mina SDK
 *
 * In a real app, this would import from 'noah-mina-sdk'.
 * For this demo, we simulate the SDK behavior client-side.
 */
import { useState, useCallback } from 'react';

// ============================================================
// Types (mirroring SDK types)
// ============================================================

export interface IdentityDocument {
    fullName: string;
    dateOfBirth: number;   // YYYYMMDD
    nationality: string;
    documentType: string;
    expiresAt: number;     // YYYYMMDD
}

export interface KYCStatus {
    commitment: string;
    issuerHash: string;
    registeredAt: string;
    isActive: boolean;
}

export interface WalletState {
    connected: boolean;
    address: string | null;
    network: string | null;
}

// ============================================================
// Hook
// ============================================================

export function useNoahSDK() {
    const [wallet, setWallet] = useState<WalletState>({
        connected: false,
        address: null,
        network: null,
    });
    const [credential, setCredential] = useState<any>(null);
    const [presentation, setPresentation] = useState<any>(null);
    const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Connect to Auro Wallet
     */
    const connectWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const mina = (window as any).mina;
            if (!mina) {
                throw new Error(
                    'Auro Wallet not found. Please install the Auro Wallet extension.'
                );
            }

            const accounts = await mina.requestAccounts();
            if (accounts.length === 0) {
                throw new Error('No accounts available');
            }

            const network = await mina.requestNetwork();

            setWallet({
                connected: true,
                address: accounts[0],
                network: network?.chainId || 'unknown',
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Disconnect wallet
     */
    const disconnectWallet = useCallback(() => {
        setWallet({ connected: false, address: null, network: null });
        setCredential(null);
        setPresentation(null);
        setKycStatus(null);
    }, []);

    /**
     * Request KYC attestation (simulate calling the Attester API)
     */
    const requestAttestation = useCallback(
        async (document: IdentityDocument) => {
            setLoading(true);
            setError(null);
            try {
                if (!wallet.address) throw new Error('Wallet not connected');

                // In production, this would POST to the attester API
                // POST /attest { ownerPublicKey, document }
                // For demo, we simulate receiving a credential
                const mockCredential = {
                    owner: wallet.address,
                    data: document,
                    issuer: 'B62q...attester',
                    signature: 'mock_signature_' + Date.now(),
                    issuedAt: new Date().toISOString(),
                };

                setCredential(mockCredential);
                return mockCredential;
            } catch (err: any) {
                setError(err.message);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [wallet.address]
    );

    /**
     * Generate an age verification proof (ZK presentation)
     */
    const generateAgeProof = useCallback(
        async (minAge: number) => {
            setLoading(true);
            setError(null);
            try {
                if (!credential) throw new Error('No credential available');

                // In production: sdk.proveAge(credential, ownerKey, minAge)
                // For demo, simulate proof generation
                const dob = credential.data.dateOfBirth;
                const now = new Date();
                const currentDate =
                    now.getFullYear() * 10000 +
                    (now.getMonth() + 1) * 100 +
                    now.getDate();

                const age = Math.floor((currentDate - dob) / 10000);
                if (age < minAge) {
                    throw new Error(
                        `Age verification failed: ${age} < ${minAge}`
                    );
                }

                const mockPresentation = {
                    type: 'age_verification',
                    proofHash: '0x' + Math.random().toString(16).slice(2, 18),
                    claims: { minAge, verified: true },
                    issuerHash: credential.issuer,
                    generatedAt: new Date().toISOString(),
                };

                setPresentation(mockPresentation);
                return mockPresentation;
            } catch (err: any) {
                setError(err.message);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [credential]
    );

    /**
     * Register KYC on-chain
     */
    const registerKYC = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!presentation) throw new Error('No proof available');
            if (!wallet.address) throw new Error('Wallet not connected');

            // In production: sdk.registerKYC(commitment, issuerHash)
            // followed by sdk.settleState()
            const mockStatus: KYCStatus = {
                commitment: '0x' + Math.random().toString(16).slice(2, 18),
                issuerHash: presentation.issuerHash,
                registeredAt: new Date().toISOString(),
                isActive: true,
            };

            setKycStatus(mockStatus);
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, [presentation, wallet.address]);

    /**
     * Query KYC status
     */
    const queryKYCStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!wallet.address) throw new Error('Wallet not connected');

            // In production: sdk.getKYCStatus(userPubKey)
            // For demo, return the stored status
            return kycStatus;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [wallet.address, kycStatus]);

    return {
        // State
        wallet,
        credential,
        presentation,
        kycStatus,
        loading,
        error,

        // Actions
        connectWallet,
        disconnectWallet,
        requestAttestation,
        generateAgeProof,
        registerKYC,
        queryKYCStatus,

        // Setters (for manual state management)
        setError,
    };
}
