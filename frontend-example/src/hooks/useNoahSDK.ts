/**
 * useNoahSDK — React Hook for Noah-Mina KYC Flow
 *
 * Manages the 5-step stepper state:
 * 1. Scan — MRZ OCR scanning
 * 2. Witness — Attestation
 * 3. Proof — ZK proof generation
 * 4. Submit — On-chain registration
 * 5. Verified — KYC bound to address
 */
import { useState, useCallback, useEffect } from 'react';
import type { MRZData } from '../components/MRZScanner';

// ============================================================
// Types
// ============================================================

export type StepId = 'scan' | 'witness' | 'proof' | 'submit' | 'verified';

export interface Step {
    id: StepId;
    label: string;
    index: number;
}

export const STEPS: Step[] = [
    { id: 'scan', label: 'Scan', index: 0 },
    { id: 'witness', label: 'Witness', index: 1 },
    { id: 'proof', label: 'Proof', index: 2 },
    { id: 'submit', label: 'Submit', index: 3 },
    { id: 'verified', label: 'Verified', index: 4 },
];

export interface WalletState {
    connected: boolean;
    address: string | null;
    network: string | null;
}

export interface KYCRecord {
    commitment: string;
    issuerHash: string;
    registeredAt: string;
    isActive: boolean;
    address: string;
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
    const [currentStep, setCurrentStep] = useState<StepId>('scan');
    const [mrzData, setMrzData] = useState<MRZData | null>(null);
    const [credential, setCredential] = useState<any>(null);
    const [presentation, setPresentation] = useState<any>(null);
    const [kycRecord, setKycRecord] = useState<KYCRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Wallet ─────────────────────────────────────────────────

    const connectWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const mina = (window as any).mina;
            if (!mina) {
                throw new Error(
                    'Auro Wallet not found. Install the Auro Wallet extension to continue.'
                );
            }

            const accounts = await mina.requestAccounts();
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts available');
            }

            let network: any = null;
            try {
                network = await mina.requestNetwork();
            } catch {
                // Some wallet versions don't support requestNetwork
            }

            const address = accounts[0];
            setWallet({
                connected: true,
                address,
                network: network?.chainId || 'devnet',
            });

            // Check if this address already has KYC
            const existingKYC = checkExistingKYC(address);
            if (existingKYC) {
                setKycRecord(existingKYC);
                setCurrentStep('verified');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const disconnectWallet = useCallback(() => {
        setWallet({ connected: false, address: null, network: null });
        setCurrentStep('scan');
        setMrzData(null);
        setCredential(null);
        setPresentation(null);
        setKycRecord(null);
    }, []);

    // ── KYC Address Check ──────────────────────────────────────

    /**
     * Check if an address already has KYC registered.
     * Returns the KYC record if found, null otherwise.
     *
     * In production: sdk.hasActiveKYC(publicKey) → calls the on-chain contract
     * For demo: checks localStorage
     */
    function checkExistingKYC(address: string): KYCRecord | null {
        try {
            const stored = localStorage.getItem(`noah_kyc_${address}`);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch {
            // ignore
        }
        return null;
    }

    /**
     * Store KYC record bound to address
     */
    function bindKYCToAddress(address: string, record: KYCRecord) {
        try {
            localStorage.setItem(`noah_kyc_${address}`, JSON.stringify(record));
        } catch {
            // ignore
        }
    }

    // ── Step 1: Scan (MRZ OCR) ─────────────────────────────────

    const onMRZScanned = useCallback((data: MRZData) => {
        setMrzData(data);
        setCurrentStep('witness');
    }, []);

    // ── Step 2: Witness (Attestation) ──────────────────────────

    const submitForAttestation = useCallback(async () => {
        if (!mrzData || !wallet.address) return;
        setLoading(true);
        setError(null);
        try {
            // In production: POST to attester API
            // const result = await fetch('/attest', {
            //   method: 'POST',
            //   body: JSON.stringify({ ownerPublicKey: wallet.address, document: mrzData })
            // });

            // Simulate attester response
            await new Promise((r) => setTimeout(r, 1500));

            const mockCredential = {
                owner: wallet.address,
                data: {
                    fullName: mrzData.fullName,
                    dateOfBirth: mrzData.dateOfBirth,
                    nationality: mrzData.nationality,
                    documentType: mrzData.documentType,
                    expiresAt: mrzData.expiresAt,
                },
                issuer: 'B62q' + Math.random().toString(36).slice(2, 14) + '...attester',
                signature: 'sig_' + Date.now().toString(36),
                issuedAt: new Date().toISOString(),
            };

            setCredential(mockCredential);
            setCurrentStep('proof');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [mrzData, wallet.address]);

    // ── Step 3: Proof (ZK Presentation) ────────────────────────

    const generateProof = useCallback(async () => {
        if (!credential) return;
        setLoading(true);
        setError(null);
        try {
            // In production: sdk.proveAge(credential, ownerKey, 18)
            await new Promise((r) => setTimeout(r, 2000));

            const mockPresentation = {
                type: 'age_verification',
                proofHash: '0x' + Array.from({ length: 32 }, () =>
                    Math.floor(Math.random() * 16).toString(16)
                ).join(''),
                claims: { minAge: 18, verified: true },
                issuerHash: credential.issuer,
                generatedAt: new Date().toISOString(),
            };

            setPresentation(mockPresentation);
            setCurrentStep('submit');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [credential]);

    // ── Step 4: Submit (On-Chain Registration) ─────────────────

    const registerOnChain = useCallback(async () => {
        if (!presentation || !wallet.address) return;
        setLoading(true);
        setError(null);
        try {
            // In production: sdk.registerKYC(commitment, issuerHash) + sdk.settleState()
            await new Promise((r) => setTimeout(r, 2000));

            const record: KYCRecord = {
                commitment: '0x' + Array.from({ length: 32 }, () =>
                    Math.floor(Math.random() * 16).toString(16)
                ).join(''),
                issuerHash: presentation.issuerHash,
                registeredAt: new Date().toISOString(),
                isActive: true,
                address: wallet.address,
            };

            setKycRecord(record);
            bindKYCToAddress(wallet.address, record);
            setCurrentStep('verified');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [presentation, wallet.address]);

    // ── Step Navigation ────────────────────────────────────────

    const getCurrentStepIndex = useCallback(() => {
        return STEPS.findIndex((s) => s.id === currentStep);
    }, [currentStep]);

    return {
        // State
        wallet,
        currentStep,
        mrzData,
        credential,
        presentation,
        kycRecord,
        loading,
        error,

        // Step info
        steps: STEPS,
        currentStepIndex: getCurrentStepIndex(),

        // Actions
        connectWallet,
        disconnectWallet,
        onMRZScanned,
        submitForAttestation,
        generateProof,
        registerOnChain,
        setError,
        setCurrentStep,
    };
}
