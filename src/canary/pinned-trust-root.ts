export const PINNED_TRUST_ROOT_JSON = JSON.stringify({
  $schema: "https://contracts.datumm.com/desktop-bridge/v2/trust-root.json",
  schema: "datumm.revit.trust-root/v1",
  issuer: "https://www.datumm.ai",
  algorithm: "Ed25519",
  keys: [{
    kid: "datum-v2-20260808-9fdac09b",
    publicKeySpkiBase64: "MCowBQYDK2VwAyEAUSeuWwKdbOiOrzYgE1GLmSX+YSudNDNYkMEjELAjQKU=",
    notBefore: "2026-08-08T00:00:00.000Z",
  }],
});
