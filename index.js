const fs = require('fs');
const bip39 = require('bip39');
const { hdkey } = require('ethereumjs-wallet');
const EthWallet = require('ethereumjs-wallet').default;
const { keccak256 } = require('js-sha3');
const bs58check = require('bs58check'); // 必须 v2

const COUNT = 100000;
const TRON_PATH = "m/44'/195'/0'/0/0";

// 目标地址（可为空）
const targetSet = fs.existsSync('targets.txt')
    ? new Set(
        fs.readFileSync('targets.txt', 'utf8')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      )
    : new Set();

// 实时写入流
const addressStream = fs.createWriteStream('addresses.txt', { flags: 'a' });
const matchedStream = fs.createWriteStream('matched.txt', { flags: 'a' });

// 私钥 → TRON 地址
function privateKeyToTronAddress(privateKeyHex) {
    const wallet = EthWallet.fromPrivateKey(Buffer.from(privateKeyHex, 'hex'));
    const pubKey = wallet.getPublicKey(); // 65 bytes
    const hash = keccak256(pubKey.slice(1)); // 去掉 0x04
    const addrHex = '41' + hash.slice(-40);  // TRON 前缀
    return bs58check.encode(Buffer.from(addrHex, 'hex'));
}

async function generate() {
    for (let i = 0; i < COUNT; i++) {
        const mnemonic = bip39.generateMnemonic();
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const hdWallet = hdkey.fromMasterSeed(seed);
        const wallet = hdWallet.derivePath(TRON_PATH).getWallet();
        const privateKey = wallet.getPrivateKey().toString('hex');
 
        const address = privateKeyToTronAddress(privateKey);

        // ✅ 每个地址都立刻写（带助记词）
        addressStream.write(`${address},${mnemonic}\n`);

        // 🎯 命中目标地址
        if (targetSet.has(address)) {
            matchedStream.write(`${address},${mnemonic},${privateKey}\n`);
            console.log('🎯 MATCH FOUND:', address);
        }

        if ((i + 1) % 1000 === 0) {
            console.log(`Generated ${i + 1}`);
        }
    }

    addressStream.end();
    matchedStream.end();
    console.log('Done.');
}

generate().catch(console.error);
