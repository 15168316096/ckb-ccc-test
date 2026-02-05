/**
 * Basic Transfer Tests for CKB CCC SDK
 * 
 * Tests basic CKB transfer functionality
 */

import { ccc } from "@ckb-ccc/ccc";
import {
  createTestContext,
  formatCkb,
  getBalance,
  logSignerInfo,
  logTransaction,
  sleep,
  TestContext,
  waitForTransaction,
} from "../utils/testHelpers.js";
import { isWriteTestEnabled } from "../config/networks.js";

describe("Basic Transfer Tests", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    console.log(`\n📋 Basic Transfer Tests - Network: ${ctx.networkName}`);
  });

  describe("Signer Operations", () => {
    it("should create signer from private key", async () => {
      if (ctx.signers.length === 0) {
        console.log("⏭️  Skipping - no signers available");
        return;
      }

      const signer = ctx.signers[0];
      
      expect(signer).toBeDefined();
      expect(signer.type).toBeDefined();
      expect(signer.signType).toBeDefined();

      console.log(`\n  Signer Type: ${signer.type}`);
      console.log(`  Sign Type: ${signer.signType}`);
    });

    it("should get signer addresses", async () => {
      if (ctx.signers.length === 0) {
        console.log("⏭️  Skipping - no signers available");
        return;
      }

      const signer = ctx.signers[0];
      
      const address = await signer.getRecommendedAddress();
      const addresses = await signer.getAddresses();
      const addressObj = await signer.getRecommendedAddressObj();

      expect(address).toBeDefined();
      expect(addresses.length).toBeGreaterThan(0);
      expect(addressObj).toBeDefined();

      console.log(`\n  Address: ${address}`);
      console.log(`  Total Addresses: ${addresses.length}`);
    });

    it("should get signer balance", async () => {
      if (ctx.signers.length === 0) {
        console.log("⏭️  Skipping - no signers available");
        return;
      }

      const signer = ctx.signers[0];
      const address = await signer.getRecommendedAddress();
      const balance = await getBalance(ctx.client, address);

      expect(balance).toBeGreaterThanOrEqual(BigInt(0));

      console.log(`\n  Address: ${address}`);
      console.log(`  Balance: ${formatCkb(balance)}`);
    });

    it("should get public key", async () => {
      if (ctx.signers.length === 0) {
        console.log("⏭️  Skipping - no signers available");
        return;
      }

      const signer = ctx.signers[0] as ccc.SignerCkbPrivateKey;
      const publicKey = signer.publicKey;

      expect(publicKey).toBeDefined();
      expect(publicKey.length).toBeGreaterThan(0);

      console.log(`\n  Public Key: ${ccc.hexFrom(publicKey).slice(0, 20)}...`);
    });
  });

  describe("Simple Transfer", () => {
    it("should create a transfer transaction", async () => {
      if (ctx.signers.length === 0) {
        console.log("⏭️  Skipping - no signers available");
        return;
      }

      const signer = ctx.signers[0];
      const { script: lock } = await signer.getRecommendedAddressObj();

      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      expect(tx.outputs.length).toBe(1);
      expect(tx.getOutputsCapacity()).toBe(ccc.fixedPointFrom(100));

      logTransaction(tx, "Created Transfer Transaction");
    });

    it("should complete transaction fee", async () => {
      if (!isWriteTestEnabled() || ctx.signers.length === 0) {
        console.log("⏭️  Skipping - write tests disabled");
        return;
      }

      const signer = ctx.signers[0];
      const address = await signer.getRecommendedAddress();
      const balance = await getBalance(ctx.client, address);

      if (balance < ccc.fixedPointFrom(200)) {
        console.log("  ⚠️  Insufficient balance, skipping test");
        return;
      }

      const { script: lock } = await signer.getRecommendedAddressObj();

      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      // Use completeFeeBy method
      await tx.completeFeeBy(signer);

      expect(tx.inputs.length).toBeGreaterThan(0);
      logTransaction(tx, "After completeFeeBy");
    });

    it("should prepare and sign transaction", async () => {
      if (!isWriteTestEnabled() || ctx.signers.length === 0) {
        console.log("⏭️  Skipping - write tests disabled");
        return;
      }

      const signer = ctx.signers[0];
      const address = await signer.getRecommendedAddress();
      const balance = await getBalance(ctx.client, address);

      if (balance < ccc.fixedPointFrom(200)) {
        console.log("  ⚠️  Insufficient balance, skipping test");
        return;
      }

      const { script: lock } = await signer.getRecommendedAddressObj();

      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      await tx.completeFeeBy(signer);

      // Prepare transaction (adds cell deps and witness placeholders)
      const preparedTx = await signer.prepareTransaction(tx);
      expect(preparedTx.cellDeps.length).toBeGreaterThan(0);
      expect(preparedTx.witnesses.length).toBeGreaterThan(0);

      // Sign transaction
      const signedTx = await signer.signTransaction(preparedTx);
      expect(signedTx.witnesses.length).toBeGreaterThan(0);

      logTransaction(signedTx, "Signed Transaction");
      console.log(`  Cell Deps: ${signedTx.cellDeps.length}`);
      console.log(`  Witnesses: ${signedTx.witnesses.length}`);
    });

    it("should execute full transfer (if enabled)", async () => {
      if (!isWriteTestEnabled() || ctx.signers.length === 0) {
        console.log("⏭️  Skipping - write tests disabled");
        return;
      }

      const signer = ctx.signers[0];
      const address = await signer.getRecommendedAddress();
      const balance = await getBalance(ctx.client, address);

      console.log(`\n  Sender: ${address}`);
      console.log(`  Balance: ${formatCkb(balance)}`);

      if (balance < ccc.fixedPointFrom(200)) {
        console.log("  ⚠️  Insufficient balance for transfer");
        return;
      }

      const { script: lock } = await signer.getRecommendedAddressObj();

      // Self transfer to minimize test impact
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      await tx.completeFeeBy(signer);
      const signedTx = await signer.signTransaction(tx);

      logTransaction(signedTx, "Final Transaction");

      // Uncomment to actually send transaction
      // const txHash = await ctx.client.sendTransaction(signedTx);
      // console.log(`  ✅ Transaction sent: ${txHash}`);
      // const confirmed = await waitForTransaction(ctx.client, txHash);
      // if (confirmed) {
      //   console.log(`  ✅ Transaction confirmed!`);
      // }

      console.log("  ✅ Transaction prepared successfully (not sent)");
    });
  });

  describe("Transfer Between Accounts", () => {
    it("should transfer between two signers", async () => {
      if (!isWriteTestEnabled() || ctx.signers.length < 2) {
        console.log("⏭️  Skipping - need at least 2 signers");
        return;
      }

      const sender = ctx.signers[0];
      const receiver = ctx.signers[1];

      const senderAddress = await sender.getRecommendedAddress();
      const receiverAddress = await receiver.getRecommendedAddress();

      const senderBalance = await getBalance(ctx.client, senderAddress);
      const receiverBalance = await getBalance(ctx.client, receiverAddress);

      console.log(`\n  Sender: ${senderAddress}`);
      console.log(`  Sender Balance: ${formatCkb(senderBalance)}`);
      console.log(`  Receiver: ${receiverAddress}`);
      console.log(`  Receiver Balance: ${formatCkb(receiverBalance)}`);

      if (senderBalance < ccc.fixedPointFrom(200)) {
        console.log("  ⚠️  Insufficient sender balance");
        return;
      }

      const { script: receiverLock } = await receiver.getRecommendedAddressObj();

      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock: receiverLock,
          },
        ],
      });

      await tx.completeFeeBy(sender);
      const signedTx = await sender.signTransaction(tx);

      logTransaction(signedTx, "Transfer Transaction");
      console.log("  ✅ Transfer transaction prepared");
    });
  });

  describe("Multiple Outputs", () => {
    it("should create transaction with multiple outputs", async () => {
      if (ctx.signers.length === 0) {
        console.log("⏭️  Skipping - no signers available");
        return;
      }

      const signer = ctx.signers[0];
      const { script: lock } = await signer.getRecommendedAddressObj();

      const tx = ccc.Transaction.from({
        outputs: [
          { capacity: ccc.fixedPointFrom(100), lock },
          { capacity: ccc.fixedPointFrom(100), lock },
          { capacity: ccc.fixedPointFrom(100), lock },
        ],
      });

      expect(tx.outputs.length).toBe(3);
      expect(tx.getOutputsCapacity()).toBe(ccc.fixedPointFrom(300));

      logTransaction(tx, "Multi-output Transaction");
    });

    it("should complete fee for multi-output transaction", async () => {
      if (!isWriteTestEnabled() || ctx.signers.length === 0) {
        console.log("⏭️  Skipping - write tests disabled");
        return;
      }

      const signer = ctx.signers[0];
      const address = await signer.getRecommendedAddress();
      const balance = await getBalance(ctx.client, address);

      if (balance < ccc.fixedPointFrom(500)) {
        console.log("  ⚠️  Insufficient balance for multi-output test");
        return;
      }

      const { script: lock } = await signer.getRecommendedAddressObj();

      const tx = ccc.Transaction.from({
        outputs: [
          { capacity: ccc.fixedPointFrom(100), lock },
          { capacity: ccc.fixedPointFrom(100), lock },
          { capacity: ccc.fixedPointFrom(100), lock },
        ],
      });

      await tx.completeFeeBy(signer);

      expect(tx.inputs.length).toBeGreaterThan(0);
      logTransaction(tx, "Completed Multi-output Transaction");
    });
  });

  describe("Custom Change Output", () => {
    it("should use completeFeeChangeToOutput", async () => {
      if (!isWriteTestEnabled() || ctx.signers.length === 0) {
        console.log("⏭️  Skipping - write tests disabled");
        return;
      }

      const signer = ctx.signers[0];
      const address = await signer.getRecommendedAddress();
      const balance = await getBalance(ctx.client, address);

      if (balance < ccc.fixedPointFrom(200)) {
        console.log("  ⚠️  Insufficient balance");
        return;
      }

      const { script: lock } = await signer.getRecommendedAddressObj();

      // Create transaction with a change output already
      const tx = ccc.Transaction.from({
        outputs: [
          { capacity: ccc.fixedPointFrom(100), lock }, // Main output
          { capacity: ccc.fixedPointFrom(61), lock },  // Change output (minimum capacity)
        ],
      });

      // Complete fee and put excess in output index 1 (the change output)
      await tx.completeFeeChangeToOutput(signer, 1);

      // The change output should have more than minimum capacity now
      const changeCapacity = tx.outputs[1].capacity;
      expect(changeCapacity).toBeGreaterThanOrEqual(ccc.fixedPointFrom(61));

      logTransaction(tx, "Transaction with Custom Change Output");
      console.log(`  Change Output Capacity: ${formatCkb(changeCapacity)}`);
    });
  });
});
