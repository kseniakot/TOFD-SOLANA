import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { mplTokenMetadata, findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";

const RPC = "https://api.devnet.solana.com";
const MINT = "3PzUoo4eDV2cN1drUD43eWnQqT3u9NQ9Xdi3jwvYrfww";

const umi = createUmi(RPC).use(mplTokenMetadata());
const mintPk = publicKey(MINT);
const [metadataPda] = findMetadataPda(umi, { mint: mintPk });

console.log("Metadata PDA:", metadataPda.toString());
