import "dotenv/config";
import { createPublicClient, defineChain, formatEther, http } from "viem";
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
    console.log("\nPlease open .env and add your private key:");
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

  const publicClient = createPublicClient({
    chain: botChain,
    transport: http(BOT_RPC_URL)
  });

  console.log("==========================================");
  console.log("   BOT Chain Mainnet Deployer Status");
  console.log("==========================================");
  console.log(`Network:     BOT Chain Mainnet (Chain ID ${BOT_CHAIN_ID})`);
  console.log(`RPC URL:     ${BOT_RPC_URL}`);
  console.log(`Deployer:    ${account.address}`);
  console.log(`Explorer:    ${BOT_EXPLORER_URL}/address/${account.address}`);

  try {
    const chainId = await publicClient.getChainId();
    if (chainId !== BOT_CHAIN_ID) {
      console.warn(`⚠️ Warning: RPC returned chainId ${chainId}, expected ${BOT_CHAIN_ID}`);
    }

    const balance = await publicClient.getBalance({ address: account.address });
    const formattedBalance = formatEther(balance);
    console.log(`Balance:     ${formattedBalance} BOT`);

    if (balance === 0n) {
      console.log("\n⚠️ Notice: Wallet balance is 0 BOT. You need BOT gas to deploy.");
      console.log(`Share your deployer address with Anthony/sponsor: ${account.address}`);
    } else {
      console.log("\n✅ Ready: Deployer has funds for contract deployment!");
      console.log("Run 'npm run deploy:contract' when ready to deploy ShipBotRegistry.");
    }
  } catch (err: any) {
    console.error("❌ Failed to connect to BOT Chain RPC:", err.message);
  }
}

main();
