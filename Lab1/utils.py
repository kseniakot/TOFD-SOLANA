import os
from solana.rpc.api import Client
from solders.pubkey import Pubkey
from dotenv import load_dotenv

LAMPORTS_PER_SOL = 1_000_000_000


def get_rpc_url_from_env() -> str:
    load_dotenv()
    cluster = os.getenv("CLUSTER", "localhost").lower()
    if cluster == "devnet":
        return os.getenv("DEVNET_RPC", "https://api.devnet.solana.com")
    return os.getenv("LOCALHOST_RPC", "http://localhost:8899")


def get_balance(rpc_url: str, pubkey: Pubkey) -> int:
    client = Client(rpc_url)
    resp = client.get_balance(pubkey)
    return resp.value
