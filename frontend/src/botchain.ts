import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type Hash
} from "viem";

export const BOT_CHAIN_ID = 677;
export const BOT_CHAIN_HEX_ID = "0x2a5";
export const BOT_RPC_URL = "https://rpc.botchain.ai";
export const BOT_EXPLORER_URL = "https://scan.botchain.ai";

export const botChain = defineChain({
  id: BOT_CHAIN_ID,
  name: "BOT Chain Mainnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [BOT_RPC_URL]
    }
  },
  blockExplorers: {
    default: {
      name: "BOT Chain Explorer",
      url: BOT_EXPLORER_URL
    }
  }
});

export const REPORT_REGISTRY_ABI = [
  {
    type: "function",
    name: "publishReport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reportHash", type: "bytes32" },
      { name: "predecessorHash", type: "bytes32" },
      { name: "version", type: "uint256" },
      { name: "reportReference", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getReport",
    stateMutability: "view",
    inputs: [{ name: "reportHash", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "publisher", type: "address" },
          { name: "reportHash", type: "bytes32" },
          { name: "predecessorHash", type: "bytes32" },
          { name: "version", type: "uint256" },
          { name: "publishedAt", type: "uint256" },
          { name: "reportReference", type: "string" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "isReportPublished",
    stateMutability: "view",
    inputs: [{ name: "reportHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "getLatestReportByReference",
    stateMutability: "view",
    inputs: [{ name: "reportRef", type: "string" }],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "event",
    name: "ReportPublished",
    inputs: [
      { name: "publisher", type: "address", indexed: true },
      { name: "reportHash", type: "bytes32", indexed: true },
      { name: "predecessorHash", type: "bytes32", indexed: true },
      { name: "version", type: "uint256", indexed: false },
      { name: "publishedAt", type: "uint256", indexed: false },
      { name: "reportReference", type: "string", indexed: false }
    ]
  }
] as const;

export const SHIPBOT_REGISTRY_ABI = REPORT_REGISTRY_ABI;

export function getRegistryContractAddress(): Address {
  const envAddr = (import.meta.env.VITE_REPORT_REGISTRY_ADDRESS as string | undefined)?.trim();
  if (envAddr && /^0x[0-9a-fA-F]{40}$/.test(envAddr)) {
    return envAddr as Address;
  }
  // Deployed ShipBotRegistry on BOT Chain Mainnet (Chain ID 677)
  return "0x421b57ea0ab9aa3e9e0422244660be9507d42c12";
}

export function isEthereumAvailable(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined";
}

export function getEthereumProvider() {
  if (!isEthereumAvailable()) {
    throw new Error("No Web3 wallet detected. Please install MetaMask or another EVM wallet.");
  }
  return (window as unknown as { ethereum: any }).ethereum;
}

export async function requestWalletConnection(): Promise<{ address: Address; chainId: number }> {
  const provider = getEthereumProvider();
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No account authorized by wallet");
  }

  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  const chainId = parseInt(chainIdHex, 16);

  return {
    address: accounts[0] as Address,
    chainId
  };
}

export async function switchToBotChain(): Promise<void> {
  const provider = getEthereumProvider();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BOT_CHAIN_HEX_ID }]
    });
  } catch (switchError: any) {
    // 4902 indicates chain has not been added to MetaMask
    if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BOT_CHAIN_HEX_ID,
            chainName: "BOT Chain Mainnet",
            nativeCurrency: {
              name: "BOT",
              symbol: "BOT",
              decimals: 18
            },
            rpcUrls: [BOT_RPC_URL],
            blockExplorerUrls: [BOT_EXPLORER_URL]
          }
        ]
      });
    } else {
      throw switchError;
    }
  }
}

export interface PublishReportParams {
  reportHash: `0x${string}`;
  predecessorHash?: `0x${string}` | null;
  version: number;
  reportReference: string;
}

export async function publishReportToChain(params: PublishReportParams): Promise<{
  transactionHash: Hash;
  blockNumber: number;
  publisher: Address;
  contractAddress: Address;
}> {
  const provider = getEthereumProvider();
  const contractAddress = getRegistryContractAddress();

  if (contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "BOT Chain registry contract address is not configured yet (VITE_REPORT_REGISTRY_ADDRESS)."
    );
  }

  const walletClient = createWalletClient({
    chain: botChain,
    transport: custom(provider)
  });

  const [account] = await walletClient.getAddresses();
  if (!account) {
    throw new Error("Wallet is not connected.");
  }

  const publicClient = createPublicClient({
    chain: botChain,
    transport: http(BOT_RPC_URL)
  });

  const predHash = params.predecessorHash ?? ("0x" + "0".repeat(64) as `0x${string}`);

  const txHash = await walletClient.writeContract({
    account,
    address: contractAddress,
    abi: REPORT_REGISTRY_ABI,
    functionName: "publishReport",
    args: [params.reportHash, predHash, BigInt(params.version), params.reportReference]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    transactionHash: txHash,
    blockNumber: Number(receipt.blockNumber),
    publisher: account,
    contractAddress
  };
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
