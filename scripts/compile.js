const fs = require('fs');
const path = require('path');
let solc;
try {
    solc = require('solc');
} catch (e) {
    solc = require('../frontend/node_modules/solc');
}
// const { ethers } = require('ethers');
// require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    // Compile Contract
    const contractPath = path.resolve(__dirname, '../contracts/PaymentChannel.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'PaymentChannel.sol': {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    console.log('Compiling contract...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        output.errors.forEach((err) => {
            console.error(err.formattedMessage);
        });
        if (output.errors.some(e => e.severity === 'error')) {
            process.exit(1);
        }
    }

    const contractFile = output.contracts['PaymentChannel.sol']['PaymentChannel'];
    const bytecode = contractFile.evm.bytecode.object;
    const abi = contractFile.abi;

    const artifact = {
        abi: abi,
        bytecode: bytecode
    };

    const outputPath = path.resolve(__dirname, '../frontend/src/contracts/PaymentChannel.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
    console.log(`Contract artifact saved to ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
