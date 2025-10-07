import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey, keypairIdentity, createSignerFromKeypair } from "@metaplex-foundation/umi";
import {
  mplTokenMetadata,
  createMetadataAccountV3,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC = "https://api.devnet.solana.com";
const KEYPATH = "/Users/ksenia/Documents/code/bsuir/TOFD/Lab2/solana_wallet.json";

const MINT = process.env.MINT;
if (!MINT) throw new Error("MINT not set. Put MINT=<mint_address> into .env");

const URI =
  "https://raw.githubusercontent.com/kseniakot/TOFD-SOLANA/refs/heads/main/Lab2/metadata.json";

const umi = createUmi(RPC).use(mplTokenMetadata());

const secret = Uint8Array.from(JSON.parse(fs.readFileSync(KEYPATH, "utf8")));
const kp = umi.eddsa.createKeypairFromSecretKey(secret);
umi.use(keypairIdentity(kp));
const signer = createSignerFromKeypair(umi, kp);

const mintPk = publicKey(MINT);
const metadataPda = findMetadataPda(umi, { mint: mintPk });

await createMetadataAccountV3(umi, {
  metadata: metadataPda,
  mint: mintPk,
  mintAuthority: signer,
  payer: signer,
  updateAuthority: signer,
  data: {
    name: "My Token",
    symbol: "MYT",
    uri: URI,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  },
  isMutable: true,
  collectionDetails: null,
}).sendAndConfirm(umi);

console.log("Metadata created for mint:", MINT);
