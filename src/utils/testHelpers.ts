import { ccc } from "@ckb-ccc/ccc";
import {
  createClient,
  getNetworkConfig,
  isMultisigTestEnabled,
  isWriteTestEnabled,
} from "../config/networks.js";

/**
 * Test context that provides client and signers for tests
 */
export interface TestContext {
  client: ccc.Client;
  signers: ccc.SignerCkbPrivateKey[];
  networkName: string;
  isReadOnly: boolean;
}

/**
 * Creates a test context with configured client and signers
 */
export async function createTestContext(): Promise<TestContext> {
  const config = getNetworkConfig();
  const client = createClient(config);

  const signers = config.privateKeys.map(
    (key) => new ccc.SignerCkbPrivateKey(client, key)
  );

  return {
    client,
    signers,
    networkName: config.name,
    isReadOnly: config.isReadOnly,
  };
}

/**
 * Wait for a transaction to be committed on chain
 */
export async function waitForTransaction(
  client: ccc.Client,
  txHash: string,
  timeout: number = 60000,
  pollInterval: number = 2000
): Promise<ccc.ClientTransactionResponse | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const tx = await client.getTransaction(txHash);
    if (tx?.status === "committed") {
      return tx;
    }
    await sleep(pollInterval);
  }

  return null;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get balance of an address in CKB
 */
export async function getBalance(
  client: ccc.Client,
  address: string
): Promise<bigint> {
  const addr = await ccc.Address.fromString(address, client);
  let balance = BigInt(0);

  for await (const cell of client.findCells({
    script: addr.script,
    scriptType: "lock",
    filter: {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    },
    scriptSearchMode: "exact",
    withData: true,
  })) {
    balance += cell.cellOutput.capacity;
  }

  return balance;
}

/**
 * Format CKB amount for display
 */
export function formatCkb(shannons: bigint): string {
  const ckb = Number(shannons) / 1e8;
  return `${ckb.toFixed(8)} CKB`;
}

/**
 * Skip test if write operations are not enabled
 */
export function skipIfReadOnly(testFn: () => void | Promise<void>) {
  if (!isWriteTestEnabled()) {
    return () => {
      console.log("⏭️  Skipping write test - read-only mode");
    };
  }
  return testFn;
}

/**
 * Skip test if multisig is not enabled (needs 3+ keys)
 */
export function skipIfMultisigDisabled(testFn: () => void | Promise<void>) {
  if (!isMultisigTestEnabled()) {
    return () => {
      console.log("⏭️  Skipping multisig test - insufficient keys");
    };
  }
  return testFn;
}

/**
 * Create a simple transfer transaction
 */
export async function createTransferTx(
  signer: ccc.Signer,
  toAddress: string,
  amount: bigint
): Promise<ccc.Transaction> {
  const toScript = (await ccc.Address.fromString(toAddress, signer.client))
    .script;

  const tx = ccc.Transaction.from({
    outputs: [
      {
        capacity: amount,
        lock: toScript,
      },
    ],
  });

  return tx;
}

/**
 * Log transaction details for debugging
 */
export function logTransaction(tx: ccc.Transaction, label: string = "Transaction") {
  console.log(`\n📝 ${label}:`);
  console.log(`  Inputs: ${tx.inputs.length}`);
  console.log(`  Outputs: ${tx.outputs.length}`);
  console.log(
    `  Total Output Capacity: ${formatCkb(tx.getOutputsCapacity())}`
  );
}

/**
 * Log signer info
 */
export async function logSignerInfo(signer: ccc.Signer) {
  const address = await signer.getRecommendedAddress();
  const balance = await getBalance(signer.client, address);
  console.log(`  Address: ${address}`);
  console.log(`  Balance: ${formatCkb(balance)}`);
}
