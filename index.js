const fs = require('fs');
const bip39 = require('bip39');
const { hdkey } = require('ethereumjs-wallet');
const EthWallet = require('ethereumjs-wallet').default;
const { keccak256 } = require('js-sha3');
const bs58check = require('bs58check'); // v2

const COUNT = 10000; // 单次碰撞次数
const TRON_PATH = "m/44'/195'/0'/0/0";

// 目标地址
const targetSet = fs.existsSync('targets.txt')
    ? new Set(
        fs.readFileSync('targets.txt', 'utf8')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      )
    : new Set();

// 写入流
const addressStream = fs.createWriteStream('addresses.txt', { flags: 'a' });
const matchedStream = fs.createWriteStream('matched.txt', { flags: 'a' });

// Ctrl+C 安全退出（关键）
process.on('SIGINT', () => {
    console.log('\n捕获中断信号，正在写入文件...');
    addressStream.end();
    matchedStream.end();
    setTimeout(() => {
        console.log('文件写入完成，安全退出');
        process.exit(0);
    }, 300);
});

// 私钥 → TRON 地址
function privateKeyToTronAddress(privateKeyHex) {
    const wallet = EthWallet.fromPrivateKey(Buffer.from(privateKeyHex, 'hex'));
    const pubKey = wallet.getPublicKey(); // 65 bytes
    const hash = keccak256(pubKey.slice(1)); // 去掉 0x04
    const addrHex = '41' + hash.slice(-40);
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

        // 每生成一条就写
        if (!addressStream.write(`${address},${mnemonic}\n`)) {
            await new Promise(resolve =>
                addressStream.once('drain', resolve)
            );
        }

        if (targetSet.has(address)) {
            matchedStream.write(`${address},${mnemonic},${privateKey}\n`);
            console.log('🎯 MATCH FOUND:', address);
        }

        console.log(`本轮碰撞次数： ${i + 1} 次：${address}助记词：${mnemonic}`);
    }

    addressStream.end();
    matchedStream.end();
    console.log('Done.');
}

generate().catch(console.error);
