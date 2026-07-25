// Public deterministic contract-test secret. Production secrets are generated per Windows user and DPAPI protected.
export const FIXTURE_PIPE_SECRET = Buffer.from("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", "hex");
