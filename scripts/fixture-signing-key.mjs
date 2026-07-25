import { createPrivateKey, createPublicKey } from "node:crypto";

// RFC 8032 test-vector seed. This key is public fixture material and must never be used outside contract tests.
const seed = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const pkcs8Prefix = "302e020100300506032b657004220420";

export const FIXTURE_ISSUER = "https://www.datumm.ai";
export const FIXTURE_KID = "fixture-ed25519-rfc8032-1";
export const FIXTURE_PRIVATE_KEY = createPrivateKey({
  key: Buffer.from(`${pkcs8Prefix}${seed}`, "hex"),
  format: "der",
  type: "pkcs8",
});
export const FIXTURE_PUBLIC_KEY = createPublicKey(FIXTURE_PRIVATE_KEY);
