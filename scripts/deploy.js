import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const artifactPath = path.join(__dirname, "../artifacts/contracts/Based2048.sol/Based2048.json");
    if (!fs.existsSync(artifactPath)) {
        console.error("Artifact not found. Run 'npx hardhat compile' first.");
        process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        console.error("PRIVATE_KEY not found in env");
        process.exit(1);
    }

    // Base Mainnet RPC
    const rpcUrl = "https://mainnet.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Deploying with account: ${wallet.address}`);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    // IPFS Metadata URI (Uploaded to Pinata)
    const metadataURI = "ipfs://QmPZrj33x2tLH8qiQGTq64FLSm7mi1ss6RRkr7JPvNmrJcs";

    console.log("Deploying contract...");
    const contract = await factory.deploy(metadataURI);

    console.log("Waiting for deployment...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`Based2048 deployed to: ${address}`);
    console.log(`Shared Metadata URI set to: ${metadataURI}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
