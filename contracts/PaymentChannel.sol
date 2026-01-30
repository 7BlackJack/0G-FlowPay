// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PaymentChannel {
    address public sender;      // Agent A
    address public receiver;    // Agent B
    uint256 public expiration;  // Timeout in case Agent B disappears

    mapping(bytes32 => bool) public usedNonces;

    event ChannelOpened(address indexed sender, address indexed receiver, uint256 amount);
    event ChannelClosed(uint256 amountPaid, uint256 amountRefunded, string blobHash);

    constructor(address _sender, address _receiver, uint256 _duration) payable {
        sender = _sender;
        receiver = _receiver;
        expiration = block.timestamp + _duration;
        emit ChannelOpened(sender, receiver, msg.value);
    }

    // Helper to recreate the message hash that was signed
    function getHash(uint256 amount, uint256 nonce, string memory blobHash) public view returns (bytes32) {
        // We include the contract address to prevent replay attacks across channels
        return keccak256(abi.encodePacked(address(this), amount, nonce, blobHash));
    }

    // Verify signature
    function verify(bytes32 hash, bytes memory signature) public pure returns (address) {
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(hash);
        return recoverSigner(ethSignedMessageHash, signature);
    }

    function getEthSignedMessageHash(bytes32 _messageHash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    // Agent B calls this to close the channel and get paid
    // Includes blobHash to prove data availability on 0G
    function close(uint256 amount, uint256 nonce, string memory blobHash, bytes memory signature) public {
        require(msg.sender == receiver, "Only receiver can close");
        require(amount <= address(this).balance, "Insufficient funds");
        
        // Verify the signature matches the claimed amount and state
        bytes32 hash = getHash(amount, nonce, blobHash);
        address signer = verify(hash, signature);
        
        require(signer == sender, "Invalid signature from sender");
        
        // Transfer payment to receiver
        payable(receiver).transfer(amount);
        
        // Refund remainder to sender
        uint256 remainder = address(this).balance;
        if (remainder > 0) {
            payable(sender).transfer(remainder);
        }
    }

    // If Agent B disappears, Agent A can claim funds after timeout
    function expire() public {
        require(msg.sender == sender, "Only sender can expire");
        require(block.timestamp >= expiration, "Not expired yet");
        selfdestruct(payable(sender));
    }
}
