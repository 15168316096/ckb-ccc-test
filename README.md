# CKB CCC SDK Integration Tests

A comprehensive Jest test suite for the [CKB CCC SDK](https://github.com/ckb-devrel/ccc), supporting devnet, testnet, and mainnet environments.

## Features Tested

### 1. Multisig Support (PR #349)
Tests for the new multisig signer functionality:
- `SignerMultisigCkbPrivateKey` - Create and sign multisig transactions
- `SignerMultisigCkbReadonly` - Monitor multisig addresses
- Transaction aggregation from multiple signers
- 2-of-3, 1-of-N, N-of-N threshold configurations
- `mustMatch` parameter for required signers

### 2. FeePayer Layer Abstraction (PR #328)
Tests for the new FeePayer abstraction (Spore zero-fee preparation):
- `FeePayer` abstract class
- `FeePayerFromAddress` - Standard fee payer implementation
- `FeePayerGroup` - Multiple fee payers combined
- `Transaction.completeByFeePayer()` - New transaction completion method
- Custom change functions and fee rate options

### 3. Basic CKB Operations
- Signer creation and address management
- Transaction creation, signing, and submission
- Balance queries
- Fee estimation

### 4. Nervos DAO
Tests for DAO-specific SDK helpers:
- `KnownScript.NervosDao` script discovery and cell deps
- DAO deposit output construction
- DAO deposited/withdrew cell phase detection
- DAO profit and claim epoch calculations
- Read-only DAO accumulator fields from block headers

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

### Environment Variables

```bash
# Network selection (devnet, testnet, mainnet)
CKB_NETWORK=devnet

# DevNet Configuration
DEVNET_RPC_URL=http://127.0.0.1:8114
DEVNET_PRIVATE_KEY_1=0x...
DEVNET_PRIVATE_KEY_2=0x...
DEVNET_PRIVATE_KEY_3=0x...

# TestNet Configuration
TESTNET_RPC_URL=https://testnet.ckb.dev/rpc
TESTNET_PRIVATE_KEY_1=0x...
TESTNET_PRIVATE_KEY_2=0x...
TESTNET_PRIVATE_KEY_3=0x...

# MainNet Configuration (readonly tests only)
MAINNET_RPC_URL=https://mainnet.ckb.dev/rpc
```

## Usage

### Run All Tests

```bash
npm test
```

### Run Tests by Network

```bash
# DevNet (default)
npm run test:dev

# TestNet
npm run test:testnet

# MainNet (readonly tests only)
npm run test:mainnet
```

### Run Specific Test Suites

```bash
# Multisig tests only
npm run test:multisig

# FeePayer tests only
npm run test:feepayer

# Basic transfer tests only
npm run test:basic

# Nervos DAO tests only
npm run test:dao

# Readonly tests only
npm run test:readonly
```

### Other Commands

```bash
# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Categories

### Readonly Tests (`readonly.test.ts`)
Can run on any network including mainnet:
- Client connection verification
- Address parsing and creation
- Transaction creation (not submission)
- Block and header queries

### Write Tests (require private keys)
- Basic transfers
- Fee completion
- Transaction signing and submission

### Multisig Tests (require 3+ private keys)
- Multisig signer creation
- 2-of-3 threshold signing
- Transaction aggregation

### DAO Tests (`dao.test.ts`)
Can run on any network. The suite uses constructed cells for deterministic DAO cell and calculation checks, and reads live header/script metadata without submitting transactions.

## Project Structure

```
ckb-ccc-test/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env.example
├── README.md
└── src/
    ├── index.ts
    ├── setup.ts
    ├── config/
    │   └── networks.ts
    ├── utils/
    │   └── testHelpers.ts
    └── __tests__/
        ├── readonly.test.ts      # Network-agnostic readonly tests
        ├── basicTransfer.test.ts # Basic CKB transfer tests
        ├── dao.test.ts           # Nervos DAO tests
        ├── multisig.test.ts      # Multisig signer tests (PR #349)
        └── feePayer.test.ts      # FeePayer layer tests (PR #328)
```

## Example: Multisig Transfer

```typescript
import { ccc } from "@ckb-ccc/ccc";

// Create signers from private keys
const signers = privateKeys.map(
  (key) => new ccc.SignerCkbPrivateKey(client, key)
);

// Get public keys
const publicKeys = signers.map((signer) => signer.publicKey);

// Create multisig signers (2-of-3)
const multisigSigners = signers.map(
  (signer) =>
    new ccc.SignerMultisigCkbPrivateKey(client, signer.privateKey, {
      publicKeys: publicKeys,
      threshold: 2,
      mustMatch: 0,
    })
);

// Create and complete transaction
let tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(100), lock }],
});
await tx.completeFeeBy(multisigSigners[0]);

// Sign with multiple signers
for (const multisigSigner of multisigSigners) {
  if (await multisigSigner.needMoreSignatures(tx)) {
    tx = await multisigSigner.signTransaction(tx);
  } else {
    const txHash = await client.sendTransaction(tx);
    console.log(`Transaction sent: ${txHash}`);
    break;
  }
}
```

## Example: FeePayer Layer

```typescript
import { ccc } from "@ckb-ccc/ccc";

// Create transaction
const tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(100), lock }],
});

// Method 1: Use single fee payer
await tx.completeByFeePayer(signer);

// Method 2: Use multiple fee payers
await tx.completeByFeePayer(signer1, signer2);

// Method 3: Use FeePayerGroup
const feePayerGroup = new ccc.FeePayerGroup([signer1, signer2]);
const completedTx = await feePayerGroup.completeTxFee(tx);

// Method 4: Custom change function
const [addedCount, hasChange] = await signer.completeFee(tx, {
  changeFn: (tx, capacity) => {
    // Custom logic
    tx.addOutput(changeCell);
    return 0;
  },
  feeRate: BigInt(1500),
});
```

## GitHub Actions CI/CD

This repository includes a comprehensive GitHub Actions workflow for regression testing.

### Automatic Triggers

- **Push/PR to main/master**: Runs tests automatically
- **Daily Schedule**: Runs at UTC 2:00 AM

### Manual Workflow Dispatch

You can trigger tests manually with custom parameters via GitHub Actions:

1. Go to **Actions** tab in your repository
2. Select **CKB CCC SDK Regression Tests** workflow
3. Click **Run workflow**
4. Configure the following options:

| Parameter | Description | Options |
|-----------|-------------|---------|
| `ccc_repo` | CCC SDK repository | `ckb-devrel/ccc` (default), or any fork |
| `ccc_ref` | Git ref (branch/tag/commit) | `master`, `feat/multisig-signer`, commit SHA, etc. |
| `network` | Target network | `testnet`, `mainnet`, `devnet`, `all` |
| `test_suite` | Test suite to run | `all`, `readonly`, `multisig`, `feepayer`, `basic` |

### Example: Test a PR Branch

To test PR #349 (multisig support):

```
ccc_repo: Hanssen0/ccc
ccc_ref: feat/multisig-signer
network: testnet
test_suite: multisig
```

### Example: Test a Specific Commit

```
ccc_repo: ckb-devrel/ccc
ccc_ref: abc123def456
network: all
test_suite: all
```

### Required Secrets

For write tests (basic transfer, multisig, etc.), configure these secrets in your repository:

| Secret | Description |
|--------|-------------|
| `TESTNET_PRIVATE_KEY` | Primary private key for testnet |
| `TESTNET_PRIVATE_KEY_2` | Second private key (for multisig) |
| `TESTNET_PRIVATE_KEY_3` | Third private key (for multisig) |

> **Note**: Mainnet tests are always read-only and don't require private keys.

### Test Matrix

The workflow automatically creates a test matrix based on your inputs:

| Network | readonly | multisig | feepayer | basic |
|---------|----------|----------|----------|-------|
| testnet | ✅ | ✅ | ✅ | ✅ |
| mainnet | ✅ | ❌ | ❌ | ❌ |
| devnet | ✅ | ✅ | ✅ | ✅ |

### Workflow File

The workflow is defined in `.github/workflows/regression-test.yml`.

## Related PRs

- [PR #349: feat(core): multisig Signers](https://github.com/ckb-devrel/ccc/pull/349)
- [PR #328: feat: new layer of FeePayer](https://github.com/ckb-devrel/ccc/pull/328)

## License

MIT
