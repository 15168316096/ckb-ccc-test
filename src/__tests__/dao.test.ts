/**
 * Nervos DAO tests for CKB CCC SDK
 *
 * These tests cover DAO script discovery, DAO cell phase detection,
 * DAO header math, and read-only header fields.
 */

import { ccc } from "@ckb-ccc/ccc";
import { createClient, getNetworkConfig } from "../config/networks.js";
import { formatCkb } from "../utils/testHelpers.js";

const ZERO_HASH = `0x${"00".repeat(32)}` as `0x${string}`;

function createHeader(
  number: bigint,
  epoch: [bigint, bigint, bigint],
  ar: bigint
): ccc.ClientBlockHeaderLike {
  return {
    compactTarget: 0n,
    dao: {
      c: 0n,
      ar,
      s: 0n,
      u: 0n,
    },
    epoch,
    extraHash: ZERO_HASH,
    hash: ZERO_HASH,
    nonce: 0n,
    number,
    parentHash: ZERO_HASH,
    proposalsHash: ZERO_HASH,
    timestamp: 0n,
    transactionsRoot: ZERO_HASH,
    version: 0n,
  };
}

describe("Nervos DAO Tests", () => {
  let client: ccc.Client;
  let daoInfo: ccc.ScriptInfo;
  let daoType: ccc.Script;
  let lock: ccc.Script;

  beforeAll(async () => {
    const config = getNetworkConfig();
    client = createClient(config);
    daoInfo = await client.getKnownScript(ccc.KnownScript.NervosDao);
    daoType = ccc.Script.from({ ...daoInfo, args: "0x" });
    lock = ccc.Script.from({
      codeHash:
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      hashType: "type",
      args: `0x${"11".repeat(20)}`,
    });

    console.log(`\nNervos DAO Tests - Network: ${config.name}`);
  });

  describe("Known Script", () => {
    it("should resolve Nervos DAO script info", async () => {
      expect(daoType).toBeDefined();
      expect(daoType.codeHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(daoType.hashType).toBe("type");
      expect(daoType.args).toBe("0x");
      expect(daoInfo.cellDeps.length).toBeGreaterThan(0);

      console.log(`\n  DAO Code Hash: ${daoType.codeHash}`);
      console.log(`  DAO Cell Deps: ${daoInfo.cellDeps.length}`);
    });

    it("should create DAO deposit output with empty data", () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(102),
            lock,
            type: daoType,
          },
        ],
        outputsData: ["0x"],
        cellDeps: [],
      });

      expect(tx.outputs.length).toBe(1);
      expect(tx.outputsData.length).toBe(1);
      expect(tx.outputs[0].type?.eq(daoType)).toBe(true);
      expect(tx.outputsData[0]).toBe("0x");

      console.log("  DAO deposit output created");
    });
  });

  describe("DAO Cell Detection", () => {
    it("should detect deposited DAO cells", async () => {
      const depositedCell = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(102),
          lock,
          type: daoType,
        },
        outputData: "0x",
      });

      expect(await depositedCell.isNervosDao(client)).toBe(true);
      expect(await depositedCell.isNervosDao(client, "deposited")).toBe(true);
      expect(await depositedCell.isNervosDao(client, "withdrew")).toBe(false);
    });

    it("should detect withdrew DAO cells with deposit block number data", async () => {
      const depositBlockNumber = 1024n;
      const withdrewCell = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(102),
          lock,
          type: daoType,
        },
        outputData: ccc.hexFrom(ccc.numToBytes(depositBlockNumber, 8)),
      });

      expect(await withdrewCell.isNervosDao(client)).toBe(true);
      expect(await withdrewCell.isNervosDao(client, "deposited")).toBe(false);
      expect(await withdrewCell.isNervosDao(client, "withdrew")).toBe(true);
    });

    it("should reject non-DAO cells", async () => {
      const normalCell = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(61),
          lock,
        },
        outputData: "0x",
      });

      expect(await normalCell.isNervosDao(client)).toBe(false);
      expect(await normalCell.isNervosDao(client, "deposited")).toBe(false);
      expect(await normalCell.isNervosDao(client, "withdrew")).toBe(false);
    });
  });

  describe("DAO Calculation Utilities", () => {
    it("should calculate DAO profit from AR growth", () => {
      const depositHeader = createHeader(1n, [10n, 0n, 1000n], 1_000_000n);
      const withdrawHeader = createHeader(2n, [190n, 0n, 1000n], 1_010_000n);
      const profitableCapacity = ccc.fixedPointFrom(100);

      const profit = ccc.calcDaoProfit(
        profitableCapacity,
        depositHeader,
        withdrawHeader
      );

      expect(profit).toBe(ccc.fixedPointFrom(1));
      console.log(`\n  DAO Profit: ${formatCkb(profit)}`);
    });

    it("should calculate the next 180-epoch claim window", () => {
      const depositHeader = createHeader(1n, [10n, 100n, 1000n], 1_000_000n);
      const withdrawHeader = createHeader(2n, [190n, 99n, 1000n], 1_010_000n);

      const claimEpoch = ccc.calcDaoClaimEpoch(depositHeader, withdrawHeader);

      expect(claimEpoch).toEqual([190n, 100n, 1000n]);
    });

    it("should roll forward when withdrawal epoch position reaches deposit position", () => {
      const depositHeader = createHeader(1n, [10n, 100n, 1000n], 1_000_000n);
      const withdrawHeader = createHeader(2n, [190n, 100n, 1000n], 1_010_000n);

      const claimEpoch = ccc.calcDaoClaimEpoch(depositHeader, withdrawHeader);

      expect(claimEpoch).toEqual([370n, 100n, 1000n]);
    });
  });

  describe("Readonly Header DAO Fields", () => {
    it("should read DAO accumulator fields from the tip header", async () => {
      const tipHeader = await client.getTipHeader();

      expect(tipHeader.dao).toBeDefined();
      expect(tipHeader.dao.c).toBeGreaterThan(0n);
      expect(tipHeader.dao.ar).toBeGreaterThan(0n);
      expect(tipHeader.dao.s).toBeGreaterThanOrEqual(0n);
      expect(tipHeader.dao.u).toBeGreaterThanOrEqual(0n);

      console.log(`\n  Tip DAO AR: ${tipHeader.dao.ar}`);
    });
  });
});
