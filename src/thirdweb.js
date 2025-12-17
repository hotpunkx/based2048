import { createThirdwebClient } from "thirdweb";
const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

if (!clientId) {
    console.error("VITE_THIRDWEB_CLIENT_ID is missing in .env!");
}

export const client = createThirdwebClient({
    clientId: clientId || "00000000000000000000000000000000", // Fallback to prevent module crash
});
