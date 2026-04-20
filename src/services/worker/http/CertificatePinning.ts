/**
 * CertificatePinning
 *
 * Certificate pinning configuration for mobile clients
 * Prevents MITM attacks by binding to specific server certificates
 */

/**
 * Certificate pin configuration
 * In production, use your actual certificate public key hashes
 */
export interface CertificatePinConfig {
  host: string;
  pins: string[]; // SHA-256 hashes of certificate public keys
  includeSubdomains?: boolean;
  expirationDate?: string;
}

/**
 * Certificate pins for API endpoints
 * Update with your actual production certificate hashes
 */
export const CERTIFICATE_PINS: CertificatePinConfig[] = [
  {
    host: 'api.example.com',
    pins: [
      // Replace with actual SHA-256 hash of your certificate public key
      // openssl x509 -in certificate.pem -noout -pubkey | openssl asn1parse -noout -inform DER -i | head -1 | awk -F: '{print $NF}' | tr -d ' ' | xxd -r -p | openssl dgst -sha256 -binary | openssl enc -base64
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
    ],
    includeSubdomains: true,
    expirationDate: '2025-12-31'
  }
];

/**
 * Validate server certificate against pinned certificates
 * This function is called by mobile HTTP clients before establishing connection
 */
export function validateCertificatePin(
  host: string,
  certificatePubKeyHash: string
): boolean {
  const pin = CERTIFICATE_PINS.find(p => {
    if (p.includeSubdomains) {
      return host.endsWith(p.host) || host === p.host;
    }
    return host === p.host;
  });

  if (!pin) {
    console.warn(`No certificate pin configured for host: ${host}`);
    return false;
  }

  // Check if certificate is expired
  if (pin.expirationDate) {
    const expiration = new Date(pin.expirationDate);
    if (new Date() > expiration) {
      console.warn(`Certificate pin expired for host: ${host}`);
      return false;
    }
  }

  // Check if provided hash matches any pinned certificate
  const isValid = pin.pins.includes(certificatePubKeyHash);
  
  if (!isValid) {
    console.error(`Certificate validation failed for host: ${host}`);
  }

  return isValid;
}

/**
 * Get certificate pins for a specific host
 */
export function getCertificatePins(host: string): string[] | null {
  const pin = CERTIFICATE_PINS.find(p => {
    if (p.includeSubdomains) {
      return host.endsWith(p.host) || host === p.host;
    }
    return host === p.host;
  });

  return pin?.pins || null;
}

/**
 * Integration instructions for mobile clients (React Native / Flutter)
 *
 * React Native (with rn-fetch-blob or similar):
 * ```
 * const pins = getCertificatePins('api.example.com');
 * RNFetchBlob.fetch('GET', 'https://api.example.com/endpoint', {
 *   'SSL-Pinning': true,
 *   pins: pins
 * })
 * ```
 *
 * Flutter (with http.dart):
 * ```
 * var client = http.IOClient(
 *   HttpClient()..badCertificateCallback = (cert, host, port) {
 *     return validateCertificatePin(host, getCertHash(cert));
 *   }
 * );
 * ```
 */
