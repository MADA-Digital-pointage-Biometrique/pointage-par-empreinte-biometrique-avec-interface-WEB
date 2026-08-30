// ============================================================
// Module WebAuthn pour authentification biométrique (empreinte/face)
// Compatible Chrome Android (WebAuthn Level 2+)
// ============================================================

class WebAuthnManager {
    constructor() {
        this.rpId = ''; // Sera défini dynamiquement
        this.rpName = 'P.Biometrique';
        this.origin = window.location.origin;
    }

    // Vérifier si WebAuthn est supporté
    static isSupported() {
        return !!(window.PublicKeyCredential && 
                  navigator.credentials && 
                  navigator.credentials.create &&
                  navigator.credentials.get);
    }

    // Vérifier si l'authentificateur de plateforme est disponible (empreinte/face)
    static async isPlatformAuthenticatorAvailable() {
        if (!this.isSupported()) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
            return false;
        }
    }

    // Configuration du RP (Relying Party)
    setRelyingParty(rpId, rpName) {
        this.rpId = rpId || window.location.hostname;
        this.rpName = rpName || 'P.Biometrique';
    }

    // Génération d'un challenge aléatoire
    static generateChallenge() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.arrayBufferToBase64URL(array.buffer);
    }

    // Conversion ArrayBuffer -> Base64URL
    static arrayBufferToBase64URL(buffer) {
        const bytes = new Uint8Array(buffer);
        let str = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    // Conversion Base64URL -> ArrayBuffer
    static base64URLToArrayBuffer(base64url) {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = base64 + (pad ? '='.repeat(4 - pad) : '');
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // ============================================================
    // ENRÔLEMENT (création de credential)
    // ============================================================
    async enroll(userId, userName, displayName) {
        if (!WebAuthnManager.isSupported()) {
            throw new Error('WebAuthn non supporté sur ce navigateur');
        }

        const hasPlatformAuth = await WebAuthnManager.isPlatformAuthenticatorAvailable();
        if (!hasPlatformAuth) {
            throw new Error('Aucun authentificateur biométrique (empreinte/face) détecté sur cet appareil');
        }

        // Récupérer le challenge depuis le serveur
        const challengeResp = await fetch(getApiEndpoint('webauthn_challenge.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'enroll', user_id: userId })
        });
        const challengeData = await challengeResp.json();
        if (!challengeData.ok) throw new Error(challengeData.message || 'Erreur challenge');

        const challenge = this.base64URLToArrayBuffer(challengeData.challenge);

        // Options de création du credential
        const publicKeyCredentialCreationOptions = {
            publicKey: {
                rp: {
                    id: this.rpId || window.location.hostname,
                    name: this.rpName
                },
                user: {
                    id: this.stringToArrayBuffer(String(userId)),
                    name: userName,
                    displayName: displayName || userName
                },
                challenge: challenge,
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },   // ES256
                    { type: 'public-key', alg: -257 }  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Force l'authentificateur de plateforme (empreinte/face)
                    requireResidentKey: false,
                    userVerification: 'required' // Force la vérification biométrique
                },
                timeout: 60000,
                attestation: 'none'
            }
        };

        try {
            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            // Envoyer le credential au serveur
            const attestationResponse = {
                id: credential.id,
                rawId: this.arrayBufferToBase64URL(credential.rawId),
                type: credential.type,
                response: {
                    attestationObject: this.arrayBufferToBase64URL(credential.response.attestationObject),
                    clientDataJSON: this.arrayBufferToBase64URL(credential.response.clientDataJSON)
                }
            };

            const verifyResp = await fetch(getApiEndpoint('webauthn_verify.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'enroll_verify',
                    user_id: userId,
                    credential: attestationResponse
                })
            });

            const result = await verifyResp.json();
            if (!result.ok) throw new Error(result.message || 'Erreur vérification enrôlement');

            return { ok: true, credentialId: credential.id };
        } catch (e) {
            if (e.name === 'NotAllowedError') {
                throw new Error('Enrôlement annulé ou biométrie refusée');
            }
            throw e;
        }
    }

    // ============================================================
    // VÉRIFICATION (authentification)
    // ============================================================
    async verify(userId) {
        if (!WebAuthnManager.isSupported()) {
            throw new Error('WebAuthn non supporté sur ce navigateur');
        }

        // Récupérer le challenge depuis le serveur
        const challengeResp = await fetch(getApiEndpoint('webauthn_challenge.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'verify', user_id: userId })
        });
        const challengeData = await challengeResp.json();
        if (!challengeData.ok) throw new Error(challengeData.message || 'Erreur challenge');

        const challenge = this.base64URLToArrayBuffer(challengeData.challenge);

        // Récupérer les credentials autorisés pour cet utilisateur
        const credsResp = await fetch(getApiEndpoint('webauthn_get_credentials.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user_id: userId })
        });
        const credsData = await credsResp.json();
        if (!credsData.ok) throw new Error(credsData.message);

        const allowCredentials = credsData.credentials.map(c => ({
            type: 'public-key',
            id: this.base64URLToArrayBuffer(c.credential_id),
            transports: ['internal']
        }));

        const publicKeyCredentialRequestOptions = {
            publicKey: {
                challenge: this.base64URLToArrayBuffer(challengeData.challenge),
                allowCredentials: allowCredentials,
                timeout: 60000,
                userVerification: 'required',
                rpId: this.rpId || window.location.hostname
            }
        };

        try {
            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            });

            const assertionResponse = {
                id: assertion.id,
                rawId: this.arrayBufferToBase64URL(assertion.rawId),
                type: assertion.type,
                response: {
                    authenticatorData: this.arrayBufferToBase64URL(assertion.response.authenticatorData),
                    clientDataJSON: this.arrayBufferToBase64URL(assertion.response.clientDataJSON),
                    signature: this.arrayBufferToBase64URL(assertion.response.signature),
                    userHandle: assertion.response.userHandle ? this.arrayBufferToBase64URL(assertion.response.userHandle) : null
                }
            };

            const verifyResp = await fetch(getApiEndpoint('webauthn_verify.php'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'verify',
                    user_id: userId,
                    assertion: assertionResponse
                })
            });

            const result = await verifyResp.json();
            if (!result.ok) throw new Error(result.message || 'Échec vérification biométrique');

            return { ok: true, user: result.user };
        } catch (e) {
            if (e.name === 'NotAllowedError') {
                throw new Error('Vérification annulée ou biométrie refusée');
            }
            throw e;
        }
    }

    // ============================================================
    // UTILITAIRES
    // ============================================================
    stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str).buffer;
    }
}

// Instance singleton
window.WebAuthn = new WebAuthnManager();