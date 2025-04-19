import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RPC_ENDPOINT = process.env.HELIUS_RPC_URL;
const web3Connection = new Connection(RPC_ENDPOINT, "confirmed");

export default async function createPumpfunCoin(coinData) {
  console.log("🚀 Starting PumpFun Coin Creation Process...");

  const signerKeyPair = Keypair.fromSecretKey(
    bs58.decode(process.env.GROK_PRIVATE_KEY)
  );
  console.log("🔑 Signer keypair loaded successfully");

  // Generate a random keypair for token
  const mintKeypair = Keypair.generate();
  console.log("🎲 Generated new mint keypair");

  const {
    name,
    symbol,
    description,
    twitter,
    telegram,
    website,
    imageFileName,
  } = coinData;

  console.log(`📝 Processing token metadata for ${name} (${symbol})`);

  // Define token metadata
  const formData = new FormData();
  const imagePath = path.join(__dirname, "..", "images", imageFileName);
  console.log(`🖼️ Loading image from: ${imagePath}`);

  // Check if image file exists
  try {
    await fs.promises.access(imagePath);
  } catch (error) {
    throw new Error(`Image file not found at path: ${imagePath}`);
  }

  const imageBuffer = await fs.promises.readFile(imagePath);
  formData.append("file", new Blob([imageBuffer]));
  formData.append("name", name);
  formData.append("symbol", symbol);
  formData.append("description", description);
  formData.append("twitter", twitter);
  formData.append("telegram", telegram);
  formData.append("website", website);
  formData.append("showName", "true");

  console.log("📤 Uploading metadata to IPFS...");
  try {
    const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("IPFS Upload Response Status:", metadataResponse.status);
      console.error("IPFS Upload Response Headers:", metadataResponse.headers);
      throw new Error(
        `IPFS upload failed with status ${metadataResponse.status}: ${errorText}`
      );
    }

    const metadataResponseJSON = await metadataResponse.json();
    console.log(
      "🚀 ~ createPumpfunCoin ~ metadataResponseJSON:",
      metadataResponseJSON
    );
    console.log("✅ IPFS metadata uploaded successfully");

    console.log("💱 Creating token on PumpFun...");
    // Get the create transaction
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publicKey: signerKeyPair.publicKey.toBase58(),
        action: "create",
        tokenMetadata: {
          name: metadataResponseJSON.metadata.name,
          symbol: metadataResponseJSON.metadata.symbol,
          uri: metadataResponseJSON.metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: "true",
        amount: 0.1, // dev buy of 1 SOL
        slippage: 10,
        priorityFee: 0.0005,
        pool: "pump",
      }),
    });

    if (response.status === 200) {
      console.log("📝 Transaction generated successfully");
      // successfully generated transaction
      const data = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(data));
      tx.sign([mintKeypair, signerKeyPair]);
      console.log("✍️ Transaction signed");
      const signature = await web3Connection.sendTransaction(tx);
      console.log("🎉 Transaction successful!");
      console.log("🔗 Transaction: https://solscan.io/tx/" + signature);
    } else {
      console.log("❌ Error creating token:", response);
    }
  } catch (error) {
    console.error("❌ Error uploading metadata to IPFS:", error);
    throw error;
  }
}

// Example usage
const coinData = {
  name: "Test Coin",
  symbol: "TEST",
  description: "Test Description",
  twitter: "https://twitter.com/test",
  telegram: "https://t.me/test",
  website: "https://test.com",
  imageFileName: "grok.png",
};

// createPumpfunCoin(coinData);
