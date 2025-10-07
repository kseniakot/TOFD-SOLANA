import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import fs from 'fs';

const RPC = process.env.RPC_URL ?? 'https://api.devnet.solana.com';
const WALLET_PATH = '/Users/ksenia/Documents/code/bsuir/TOFD/Lab2/solana_wallet.json';

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8')))
);
const connection = new Connection(RPC, 'confirmed');

const decimals = 6;

const mint = await createMint(connection, payer, payer.publicKey, null, decimals);

const mintAccount = await getMint(connection, mint);

const ata = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey
);

await mintTo(connection, payer, mint, ata.address, payer, 1_000_000n);

console.log('Mint:', mint.toBase58());
console.log('ATA:', ata.address.toBase58());
console.log('Decimals:', mintAccount.decimals);
console.log('Supply:', mintAccount.supply.toString());