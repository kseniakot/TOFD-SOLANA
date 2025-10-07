import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
  getAccount,
} from '@solana/spl-token';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const RPC = process.env.RPC_URL ?? 'https://api.devnet.solana.com';
const WALLET_PATH = '/Users/ksenia/Documents/code/bsuir/TOFD/Lab2/solana_wallet.json';
const RECIPIENT_1_PATH = '/Users/ksenia/Documents/code/bsuir/TOFD/Lab2/wallet_1.json';
const RECIPIENT_2_PATH = '/Users/ksenia/Documents/code/bsuir/TOFD/Lab2/wallet_2.json';

function readKeypair(path) {
  const secret = JSON.parse(fs.readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function readPubkeyFromFile(path) {
  const secret = JSON.parse(fs.readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey;
}

const MINT = process.env.MINT;
if (!MINT) throw new Error('MINT not set. Put MINT=<mint_address> into .env');

const connection = new Connection(RPC, 'confirmed');
const payer = readKeypair(WALLET_PATH);
const mint = new PublicKey(MINT);

// Recipients from project files per readme
const recipients = [
  readPubkeyFromFile(RECIPIENT_1_PATH),
  readPubkeyFromFile(RECIPIENT_2_PATH),
];

console.log('Using payer:', payer.publicKey.toBase58());
console.log('Mint:', mint.toBase58());
console.log('Recipients:', recipients.map((p) => p.toBase58()));

// Transfer amounts per readme: 100 to first, 250 to second (ui units)
const mintInfo = await getMint(connection, mint);
const decimals = mintInfo.decimals;
const uiToBase = (ui) => BigInt(Math.round(ui * 10 ** decimals));

const amounts = [uiToBase(0.4), uiToBase(0.6)];

// Ensure payer has an ATA and enough balance
const payerAta = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey
);
const payerAtaInfo = await getAccount(connection, payerAta.address);
const totalNeeded = amounts.reduce((a, b) => a + b, 0n);

if (payerAtaInfo.amount < totalNeeded) {
  throw new Error(
    `Insufficient balance in payer ATA ${payerAta.address.toBase58()}. ` +
      `Have ${payerAtaInfo.amount.toString()} need ${totalNeeded.toString()} (base units). ` +
      'Top up your ATA first (e.g., mint to yourself), then re-run.'
  );
}

for (let i = 0; i < recipients.length; i++) {
  const recipient = recipients[i];
  const amount = amounts[i];
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    recipient
  );

  console.log(
    `Transferring ${Number(amount) / 10 ** decimals} tokens to ${recipient.toBase58()} ...`
  );

  await transfer(
    connection,
    payer,
    payerAta.address,
    recipientAta.address,
    payer,
    amount
  );

  const bal = await connection.getTokenAccountBalance(recipientAta.address);
  console.log(
    `Recipient balance now: ${bal.value.uiAmountString} (ATA ${recipientAta.address.toBase58()})`
  );
}

console.log('Done.');


