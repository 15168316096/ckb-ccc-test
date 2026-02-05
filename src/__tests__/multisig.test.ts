/**
 * Multisig Tests for CKB CCC SDK
 * 
 * Tests the new multisig signer functionality from PR #349
 * Reference: https://github.com/Hanssen0/ccc/blob/feat/multisig-signer/packages/examples/src/transferFromMultisig.ts
 * 
 * NOTE: These tests require PR #349 to be merged.
 * Until then, tests will be skipped with appropriate messages.
 */

import { ccc } from "@ckb-ccc/ccc";
import {
  createTestContext,
  formatCkb,
  getBalance,
  logTransaction,
  TestContext,
  waitForTransaction,
} from "../utils/testHelpers.js";
import { isMultisigTestEnabled, isWriteTestEnabled } from "../config/networks.js";

// Check if SignerMultisigCkbPrivateKey exists in current version
const hasMultisigSupport = typeof (ccc as any).SignerMultisigCkbPrivateKey !== "undefined";

describe("Multisig Signer Tests", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    console.log(`\n📋 Multisig Tests - Network: ${ctx.networkName}`);
    if (!hasMultisigSupport) {
      console.log("⚠️  SignerMultisigCkbPrivateKey not available - PR #349 not merged yet");
    }
  });

  describe("Multisig Signer Creation", () => {
    it("should create SignerMultisigCkbPrivateKey with valid config", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled (need 3+ keys)");
        return;
      }

      const signers = ctx.signers;
      expect(signers.length).toBeGreaterThanOrEqual(3);

      // Get public keys from all signers
      const publicKeys = signers.map((signer) => signer.publicKey);
      expect(publicKeys.length).toBe(signers.length);

      // Create multisig signer with 2-of-3 threshold
      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;
      const multisigSigner = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        {
          publicKeys: publicKeys,
          threshold: 2,
          mustMatch: 0,
        }
      );

      expect(multisigSigner).toBeDefined();
      
      // Verify multisig info
      const threshold = await multisigSigner.getMemberThreshold();
      const memberCount = await multisigSigner.getMemberCount();
      
      expect(threshold).toBe(2);
      expect(memberCount).toBe(3);
    });

    it("should create SignerMultisigCkbReadonly for monitoring", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      // Create readonly multisig signer
      const SignerMultisigCkbReadonly = (ccc as any).SignerMultisigCkbReadonly;
      const multisigReadonly = new SignerMultisigCkbReadonly(
        ctx.client,
        {
          publicKeys: publicKeys,
          threshold: 2,
          mustMatch: 0,
        }
      );

      expect(multisigReadonly).toBeDefined();
      
      // Should be able to get address
      const address = await multisigReadonly.getRecommendedAddress();
      expect(address).toBeDefined();
      console.log(`  Multisig Address: ${address}`);
    });

    it("should generate same address for same multisig config", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);
      
      const config = {
        publicKeys: publicKeys,
        threshold: 2,
        mustMatch: 0,
      };

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;

      // Create multiple multisig signers with same config
      const multisig1 = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        config
      );

      const multisig2 = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[1].privateKey,
        config
      );

      const address1 = await multisig1.getRecommendedAddress();
      const address2 = await multisig2.getRecommendedAddress();

      // Same config should generate same address
      expect(address1).toBe(address2);
      console.log(`  Consistent Multisig Address: ${address1}`);
    });
  });

  describe("Multisig Transaction Creation", () => {
    it("should prepare multisig transaction", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;
      const multisigSigner = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        {
          publicKeys: publicKeys,
          threshold: 2,
          mustMatch: 0,
        }
      );

      // Get a destination address (first signer's address)
      const { script: lock } = await signers[0].getRecommendedAddressObj();

      // Create a simple transaction
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      // Prepare the transaction
      const preparedTx = await multisigSigner.prepareTransaction(tx);
      
      expect(preparedTx).toBeDefined();
      expect(preparedTx.outputs.length).toBe(1);
      logTransaction(preparedTx, "Prepared Multisig Transaction");
    });

    it("should check if more signatures are needed", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;
      const multisigSigner = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        {
          publicKeys: publicKeys,
          threshold: 2,
          mustMatch: 0,
        }
      );

      const { script: lock } = await signers[0].getRecommendedAddressObj();
      
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      // Before any signing, should need more signatures
      const needsMore = await multisigSigner.needMoreSignatures(tx);
      expect(needsMore).toBe(true);

      // Check signature count
      const sigCount = await multisigSigner.getSignaturesCount(tx);
      console.log(`  Signature count: ${sigCount}`);
    });
  });

  describe("Multisig Full Flow", () => {
    it("should complete a 2-of-3 multisig transfer", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled() || !isWriteTestEnabled()) {
        console.log("⏭️  Skipping - write tests disabled or insufficient keys");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;

      // Create multisig signers for all participants
      const multisigSigners = signers.map(
        (signer) =>
          new SignerMultisigCkbPrivateKey(ctx.client, signer.privateKey, {
            publicKeys: publicKeys,
            threshold: 2,
            mustMatch: 0,
          })
      );

      // Get multisig address and check balance
      const multisigAddress = await multisigSigners[0].getRecommendedAddress();
      const multisigBalance = await getBalance(ctx.client, multisigAddress);
      console.log(`\n  Multisig Address: ${multisigAddress}`);
      console.log(`  Multisig Balance: ${formatCkb(multisigBalance)}`);

      // Skip actual transfer if no balance
      if (multisigBalance < ccc.fixedPointFrom(200)) {
        console.log("  ⚠️  Insufficient multisig balance, skipping transfer");
        console.log("  Please fund the multisig address first.");
        return;
      }

      // Create transfer transaction
      const { script: lock } = await signers[0].getRecommendedAddressObj();
      let tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      // Complete fee using first multisig signer
      await tx.completeFeeBy(multisigSigners[0]);
      logTransaction(tx, "After Fee Completion");

      // Sign with multiple signers until threshold is met
      for (const multisigSigner of multisigSigners) {
        if (await multisigSigner.needMoreSignatures(tx)) {
          tx = await multisigSigner.signTransaction(tx);

          const signaturesCount = await multisigSigner.getSignaturesCount(tx);
          const threshold = await multisigSigner.getMemberThreshold();
          const memberCount = await multisigSigner.getMemberCount();

          if (signaturesCount == null) {
            console.log(
              `  Need ${threshold} signatures, ${memberCount} members in total`
            );
          } else {
            console.log(
              `  ${signaturesCount}/${memberCount} signers signed, need ${threshold - signaturesCount} more`
            );
          }
        } else {
          // Enough signatures, send transaction
          const txHash = await ctx.client.sendTransaction(tx);
          console.log(`  ✅ Transaction sent: ${txHash}`);

          // Wait for confirmation
          const confirmed = await waitForTransaction(ctx.client, txHash);
          if (confirmed) {
            console.log(`  ✅ Transaction confirmed!`);
          } else {
            console.log(`  ⚠️  Transaction pending...`);
          }
          break;
        }
      }
    });
  });

  describe("Multisig Edge Cases", () => {
    it("should handle 1-of-N threshold", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;

      // 1-of-3 configuration
      const multisigSigner = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        {
          publicKeys: publicKeys,
          threshold: 1,
          mustMatch: 0,
        }
      );

      const threshold = await multisigSigner.getMemberThreshold();
      expect(threshold).toBe(1);
    });

    it("should handle N-of-N threshold (all required)", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;

      // 3-of-3 configuration
      const multisigSigner = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        {
          publicKeys: publicKeys,
          threshold: 3,
          mustMatch: 0,
        }
      );

      const threshold = await multisigSigner.getMemberThreshold();
      const memberCount = await multisigSigner.getMemberCount();
      
      expect(threshold).toBe(3);
      expect(memberCount).toBe(3);
    });

    it("should handle mustMatch parameter", async () => {
      if (!hasMultisigSupport) {
        console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
        return;
      }

      if (!isMultisigTestEnabled()) {
        console.log("⏭️  Skipping - multisig tests disabled");
        return;
      }

      const signers = ctx.signers;
      const publicKeys = signers.map((signer) => signer.publicKey);

      const SignerMultisigCkbPrivateKey = (ccc as any).SignerMultisigCkbPrivateKey;

      // 2-of-3 with first key required (mustMatch = 1)
      const multisigSigner = new SignerMultisigCkbPrivateKey(
        ctx.client,
        signers[0].privateKey,
        {
          publicKeys: publicKeys,
          threshold: 2,
          mustMatch: 1, // First key must always sign
        }
      );

      expect(multisigSigner).toBeDefined();
      
      const address = await multisigSigner.getRecommendedAddress();
      console.log(`  Multisig with mustMatch=1: ${address}`);
    });
  });
});

describe("Transfer to Multisig", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("should transfer CKB to a multisig address", async () => {
    if (!hasMultisigSupport) {
      console.log("⏭️  Skipping - PR #349 (Multisig) not merged yet");
      return;
    }

    if (!isMultisigTestEnabled() || !isWriteTestEnabled()) {
      console.log("⏭️  Skipping - write tests disabled or insufficient keys");
      return;
    }

    const signers = ctx.signers;
    const publicKeys = signers.map((signer) => signer.publicKey);

    const SignerMultisigCkbReadonly = (ccc as any).SignerMultisigCkbReadonly;

    // Create multisig readonly to get the address
    const multisigReadonly = new SignerMultisigCkbReadonly(
      ctx.client,
      {
        publicKeys: publicKeys,
        threshold: 2,
        mustMatch: 0,
      }
    );

    const multisigAddress = await multisigReadonly.getRecommendedAddressObj();
    console.log(`\n  Multisig Address: ${multisigAddress.toString()}`);

    // Check sender balance
    const senderAddress = await signers[0].getRecommendedAddress();
    const senderBalance = await getBalance(ctx.client, senderAddress);
    console.log(`  Sender Balance: ${formatCkb(senderBalance)}`);

    if (senderBalance < ccc.fixedPointFrom(200)) {
      console.log("  ⚠️  Insufficient sender balance, skipping transfer");
      return;
    }

    // Create transfer to multisig
    const tx = ccc.Transaction.from({
      outputs: [
        {
          capacity: ccc.fixedPointFrom(100),
          lock: multisigAddress.script,
        },
      ],
    });

    // Complete fee and sign
    await tx.completeFeeBy(signers[0]);
    const signedTx = await signers[0].signTransaction(tx);
    
    logTransaction(signedTx, "Transfer to Multisig");

    // Send transaction
    const txHash = await ctx.client.sendTransaction(signedTx);
    console.log(`  ✅ Transaction sent: ${txHash}`);

    // Wait for confirmation
    const confirmed = await waitForTransaction(ctx.client, txHash);
    if (confirmed) {
      console.log(`  ✅ Transaction confirmed!`);
      
      // Verify multisig balance increased
      const newBalance = await getBalance(ctx.client, multisigAddress.toString());
      console.log(`  New Multisig Balance: ${formatCkb(newBalance)}`);
    }
  });
});
