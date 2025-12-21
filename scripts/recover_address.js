import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(privateKey, provider);

    const nonce = await provider.getTransactionCount(wallet.address);
    const deployNonce = nonce - 1;

    const contractAddress = ethers.getCreateAddress({
        from: wallet.address,
        nonce: deployNonce
    });

    fs.writeFileSync("address.txt", contractAddress);
}

main().catch(console.error);
