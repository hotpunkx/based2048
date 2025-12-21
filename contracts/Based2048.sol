// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Based2048 is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _sharedTokenURI;

    constructor(
        string memory initialURI
    ) ERC721("Based2048 Access Pass", "B2048") Ownable(msg.sender) {
        _sharedTokenURI = initialURI;
    }

    function mint() public {
        uint256 tokenId = _nextTokenId;
        unchecked {
            _nextTokenId++;
        }
        _safeMint(msg.sender, tokenId);
    }

    function setSharedURI(string calldata newURI) external onlyOwner {
        _sharedTokenURI = newURI;
    }

    // Override tokenURI to return the same URI for all tokens
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _sharedTokenURI;
    }
}
