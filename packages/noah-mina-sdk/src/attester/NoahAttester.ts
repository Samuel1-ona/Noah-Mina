/**
 * NoahAttester — Attester Service for KYC Credential Issuance
 *
 * The "Digital Notary" — an Express service that:
 * 1. Receives identity documents (passport images via OCR)
 * 2. Validates the extracted data
 * 3. Issues a signed Native credential using mina-attestations
 *
 * Replaces: backend/attester (Go service) from Noah-Clarity
 *
 * Port: 8081
 */
import { PrivateKey, PublicKey, UInt64 } from 'o1js';
import { Credential } from 'mina-attestations';
import { KYCCredentialData, String64, String128 } from '../credentials/NoahCredential.js';

// ============================================================
// Types
// ============================================================

/** Raw identity data extracted from a document via OCR */
export interface IdentityDocument {
    /** Full legal name */
    fullName: string;
    /** Date of birth in YYYYMMDD format */
    dateOfBirth: number;
    /** ISO nationality code (e.g. "US", "NG", "DE") */
    nationality: string;
    /** Document type: "passport", "national_id", "drivers_license" */
    documentType: string;
    /** Document expiry date in YYYYMMDD format */
    expiresAt: number;
}

/** Result of credential issuance */
export interface AttestationResult {
    /** The signed credential (to be stored by the user) */
    credential: any; // StoredCredential type from mina-attestations
    /** The issuer's public key (for verification) */
    issuerPublicKey: string;
}

// ============================================================
// Attester Service Class
// ============================================================

export class NoahAttester {
    private issuerPrivateKey: PrivateKey;
    public issuerPublicKey: PublicKey;

    constructor(issuerPrivateKey: PrivateKey) {
        this.issuerPrivateKey = issuerPrivateKey;
        this.issuerPublicKey = issuerPrivateKey.toPublicKey();
    }

    /**
     * Create an attester with a random key (for testing/dev)
     */
    static createRandom(): NoahAttester {
        return new NoahAttester(PrivateKey.random());
    }

    /**
     * Create an attester from a base58-encoded private key
     */
    static fromBase58(privateKeyBase58: string): NoahAttester {
        return new NoahAttester(PrivateKey.fromBase58(privateKeyBase58));
    }

    /**
     * Validate and issue a KYC credential.
     *
     * In production, this would include:
     * - OCR processing of passport/ID images
     * - Document authenticity verification
     * - Liveness checks
     * - Sanctions screening
     *
     * For now, it validates the data structure and issues the credential.
     *
     * @param ownerPublicKey - The Mina public key of the user receiving the credential
     * @param document - Identity data extracted from the document
     * @returns Signed credential and issuer public key
     */
    async issueCredential(
        ownerPublicKey: PublicKey,
        document: IdentityDocument
    ): Promise<AttestationResult> {
        // --- Validation ---
        this.validateDocument(document);

        // --- Build credential data ---
        const credentialData = {
            fullName: String128.from(document.fullName),
            dateOfBirth: UInt64.from(document.dateOfBirth),
            nationality: String64.from(document.nationality),
            documentType: String64.from(document.documentType),
            expiresAt: UInt64.from(document.expiresAt),
        };

        // --- Sign the credential with attester's Mina private key ---
        const signedCredential = Credential.sign(this.issuerPrivateKey, {
            owner: ownerPublicKey,
            data: credentialData,
        });

        return {
            credential: signedCredential,
            issuerPublicKey: this.issuerPublicKey.toBase58(),
        };
    }

    /**
     * Validate that the identity document data is well-formed.
     * In production, this would also verify OCR output quality.
     */
    private validateDocument(document: IdentityDocument): void {
        if (!document.fullName || document.fullName.length < 2) {
            throw new Error('Invalid full name: must be at least 2 characters');
        }
        if (document.fullName.length > 128) {
            throw new Error('Invalid full name: exceeds 128 characters');
        }

        // Validate DOB format (YYYYMMDD)
        const dobStr = String(document.dateOfBirth);
        if (dobStr.length !== 8) {
            throw new Error(
                'Invalid date of birth: must be in YYYYMMDD format (e.g. 19900115)'
            );
        }

        // Validate nationality (2-3 letter ISO code)
        if (
            !document.nationality ||
            document.nationality.length < 2 ||
            document.nationality.length > 64
        ) {
            throw new Error('Invalid nationality code');
        }

        // Validate document type
        const validTypes = ['passport', 'national_id', 'drivers_license'];
        if (!validTypes.includes(document.documentType)) {
            throw new Error(
                `Invalid document type: must be one of ${validTypes.join(', ')}`
            );
        }

        // Validate expiry date
        const expiryStr = String(document.expiresAt);
        if (expiryStr.length !== 8) {
            throw new Error(
                'Invalid expiry date: must be in YYYYMMDD format'
            );
        }
    }
}

// ============================================================
// Express Server (optional, for standalone deployment)
// ============================================================

/**
 * Create an Express server for the attester service.
 * Can be used standalone or embedded in a larger application.
 */
export async function createAttesterServer(
    attester: NoahAttester,
    port: number = 8081
) {
    // Dynamic import to avoid requiring express when using SDK only
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    /**
     * POST /attest
     * Body: { ownerPublicKey: string, document: IdentityDocument }
     * Returns: { credential: StoredCredential, issuerPublicKey: string }
     */
    app.post('/attest', async (req, res) => {
        try {
            const { ownerPublicKey, document } = req.body;

            if (!ownerPublicKey || !document) {
                res.status(400).json({ error: 'Missing ownerPublicKey or document' });
                return;
            }

            const owner = PublicKey.fromBase58(ownerPublicKey);
            const result = await attester.issueCredential(owner, document);

            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    /** GET /health */
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            issuer: attester.issuerPublicKey.toBase58(),
        });
    });

    app.listen(port, () => {
        console.log(`Noah Attester Service running on port ${port}`);
        console.log(`Issuer public key: ${attester.issuerPublicKey.toBase58()}`);
    });

    return app;
}
