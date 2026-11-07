import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BOT_CHAIN_ID = 677;
const BOT_RPC_URL = process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai";
const BOT_EXPLORER_URL = "https://scan.botchain.ai";

const botChain = defineChain({
  id: BOT_CHAIN_ID,
  name: "BOT Chain Mainnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [BOT_RPC_URL] } },
  blockExplorers: { default: { name: "BOT Chain Explorer", url: BOT_EXPLORER_URL } }
});

async function main() {
  const rawKey = process.env.BOT_CHAIN_DEPLOYER_PRIVATE_KEY?.trim();
  if (!rawKey) {
    console.error("❌ Error: BOT_CHAIN_DEPLOYER_PRIVATE_KEY is not set in .env");
    console.log("\nPlease open .env and set your private key:");
    console.log("BOT_CHAIN_DEPLOYER_PRIVATE_KEY=0x...");
    process.exit(1);
  }

  const formattedKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  let account;
  try {
    account = privateKeyToAccount(formattedKey);
  } catch (err: any) {
    console.error("❌ Error: Invalid private key format:", err.message);
    process.exit(1);
  }

  // Read compiled contract artifact
  const artifactPath = join(process.cwd(), "contracts", "out", "ReportRegistry.sol", "ShipBotRegistry.json");
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  } catch {
    console.error(`❌ Error: Contract artifact not found at ${artifactPath}. Run 'npm run test:contracts' first.`);
    process.exit(1);
  }

  const abi = artifact.abi;
  const bytecode = artifact.bytecode?.object || artifact.bytecode;
  if (!bytecode || bytecode === "0x") {
    console.error("❌ Error: Bytecode is empty in contract artifact.");
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botChain,
    transport: http(BOT_RPC_URL)
  });

  const walletClient = createWalletClient({
    account,
    chain: botChain,
    transport: http(BOT_RPC_URL)
  });

  console.log("==========================================");
  console.log("   Deploying ShipBotRegistry to BOT Chain");
  console.log("==========================================");
  console.log(`Network:     BOT Chain Mainnet (Chain ID ${BOT_CHAIN_ID})`);
  console.log(`RPC URL:     ${BOT_RPC_URL}`);
  console.log(`Deployer:    ${account.address}`);

  const chainId = await publicClient.getChainId();
  if (chainId !== BOT_CHAIN_ID) {
    console.error(`❌ Chain ID mismatch: connected to ${chainId}, expected ${BOT_CHAIN_ID}`);
    process.exit(1);
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:     ${formatEther(balance)} BOT`);
  if (balance === 0n) {
    console.error("❌ Error: Deployer balance is 0 BOT. Gas is required to deploy.");
    process.exit(1);
  }

  const gasPrice = await publicClient.getGasPrice();
  console.log(`Gas Price:   ${gasPrice.toString()} wei (${Number(gasPrice) / 1e9} Gwei)`);

  console.log("\nBroadcasting deployment transaction...");
  const txHash = await walletClient.deployContract({
    abi,
    bytecode: bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
    gasPrice
  });
  console.log(`Transaction Hash: ${txHash}`);
  console.log(`Explorer Link:    ${BOT_EXPLORER_URL}/tx/${txHash}`);
  console.log("Waiting for block confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    console.error("❌ Deployment transaction reverted on-chain!");
    process.exit(1);
  }

  const contractAddress = receipt.contractAddress;
  console.log("\n🎉 ShipBotRegistry successfully deployed!");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Block Number:     ${receipt.blockNumber}`);
  console.log(`Gas Used:         ${receipt.gasUsed.toString()}`);
  console.log(`Explorer Link:    ${BOT_EXPLORER_URL}/address/${contractAddress}`);

  const bytecodeAtAddress = await publicClient.getBytecode({ address: contractAddress! });
  if (!bytecodeAtAddress || bytecodeAtAddress === "0x") {
    console.error("❌ Warning: No bytecode found at deployed address!");
  } else {
    console.log(`✅ Bytecode verified on-chain (${bytecodeAtAddress.length / 2 - 1} bytes).`);
  }

  // Automatically update .env
  updateEnvFile(contractAddress!);
  console.log("\n✅ Updated .env with VITE_REPORT_REGISTRY_ADDRESS=" + contractAddress);
}

function updateEnvFile(contractAddress: string) {
  const envPath = join(process.cwd(), ".env");
  let content = "";
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    content = "";
  }

  if (content.includes("VITE_REPORT_REGISTRY_ADDRESS=")) {
    content = content.replace(
      /VITE_REPORT_REGISTRY_ADDRESS=.*/,
      `VITE_REPORT_REGISTRY_ADDRESS=${contractAddress}`
    );
  } else {
    content += `\nVITE_REPORT_REGISTRY_ADDRESS=${contractAddress}\n`;
  }

  writeFileSync(envPath, content);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
});
