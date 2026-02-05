/**
 * CKB CCC SDK Integration Tests
 * 
 * This package provides a comprehensive test suite for the CKB CCC SDK,
 * supporting devnet, testnet, and mainnet environments.
 * 
 * Key features tested:
 * - Multisig (PR #349): SignerMultisigCkbPrivateKey, SignerMultisigCkbReadonly
 * - FeePayer Layer (PR #328): FeePayer, FeePayerFromAddress, FeePayerGroup
 * - Basic CKB operations: transfers, signing, address management
 * 
 * Usage:
 *   npm test                    # Run all tests on devnet
 *   npm run test:dev            # Run tests on devnet
 *   npm run test:testnet        # Run tests on testnet
 *   npm run test:mainnet        # Run readonly tests on mainnet
 *   npm run test:multisig       # Run multisig tests only
 *   npm run test:feepayer       # Run fee payer tests only
 */

export * from "./config/networks.js";
export * from "./utils/testHelpers.js";
