import { ccc } from "@ckb-ccc/ccc";
import dotenv from "dotenv";

dotenv.config();

export type NetworkType = "devnet" | "testnet" | "mainnet";

export interface NetworkConfig {
  name: NetworkType;
  rpcUrl: string;
  privateKeys: string[];
  isReadOnly: boolean;
}

const networks: Record<NetworkType, NetworkConfig> = {
  devnet: {
    name: "devnet",
    rpcUrl: process.env.DEVNET_RPC_URL || "http://127.0.0.1:8114",
    privateKeys: [
      process.env.DEVNET_PRIVATE_KEY_1 ||
        "0x2c56a92a03d767542222432e4f2a0584f01e516311f705041d86b1af7573751f",
      process.env.DEVNET_PRIVATE_KEY_2 ||
        "0x3bc65932a75f76c5b6a04660e4d0b85c2d9b5114efa78e6e5cf7ad0588ca09c8",
      process.env.DEVNET_PRIVATE_KEY_3 ||
        "0xbe06025fbd8c74f65a513a28e62ac56f3227fcb307307a0f2a0ef34d4a66e81f",
    ],
    isReadOnly: false,
  },
  testnet: {
    name: "testnet",
    rpcUrl: process.env.TESTNET_RPC_URL || "https://testnet.ckb.dev/rpc",
    privateKeys: [
      process.env.TESTNET_PRIVATE_KEY_1 || "",
      process.env.TESTNET_PRIVATE_KEY_2 || "",
      process.env.TESTNET_PRIVATE_KEY_3 || "",
    ].filter(Boolean),
    isReadOnly: false,
  },
  mainnet: {
    name: "mainnet",
    rpcUrl: process.env.MAINNET_RPC_URL || "https://mainnet.ckb.dev/rpc",
    privateKeys: [],
    isReadOnly: true,
  },
};

export function getNetworkConfig(): NetworkConfig {
  const networkName = (process.env.CKB_NETWORK || "devnet") as NetworkType;
  const config = networks[networkName];
  
  if (!config) {
    throw new Error(`Unknown network: ${networkName}`);
  }
  
  return config;
}

export function createClient(config?: NetworkConfig): ccc.Client {
  const networkConfig = config || getNetworkConfig();
  
  // Use ClientPublicTestnet or ClientPublicMainnet for public networks
  if (networkConfig.name === "testnet") {
    return new ccc.ClientPublicTestnet();
  }
  
  if (networkConfig.name === "mainnet") {
    return new ccc.ClientPublicMainnet();
  }
  
  // For devnet, create a custom client with the RPC URL
  return new ccc.ClientPublicTestnet({
    url: networkConfig.rpcUrl,
  });
}

export function isWriteTestEnabled(): boolean {
  const config = getNetworkConfig();
  
  // Mainnet only allows readonly tests
  if (config.isReadOnly) {
    return false;
  }
  
  // Check if we have valid private keys for write tests
  return config.privateKeys.length >= 1;
}

export function isMultisigTestEnabled(): boolean {
  const config = getNetworkConfig();
  
  if (config.isReadOnly) {
    return false;
  }
  
  // Multisig tests require at least 3 private keys
  return config.privateKeys.length >= 3;
}
