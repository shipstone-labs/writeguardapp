// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract WriteguardNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    uint256 public mintingFee = 0.001 ether;
    
    struct PaperMetadata {
        string fileHash;
        string fileName;
        address author;
        uint256 timestamp;
        string modelHash; // For HuggingFace model reference
    }
    
    mapping(uint256 => PaperMetadata) public papers;
    mapping(string => bool) public hashExists;
    mapping(string => uint256) public hashToTokenId;
    
    event PaperMinted(
        uint256 indexed tokenId,
        address indexed author,
        string fileHash,
        string fileName,
        uint256 timestamp
    );
    
    event ModelUpdated(
        uint256 indexed tokenId,
        string modelHash
    );

    constructor() ERC721("WriteguardNFT", "WGRD") Ownable(msg.sender) {}

    function mintPaper(
        string memory fileHash,
        string memory fileName
    ) public payable returns (uint256) {
        require(msg.value >= mintingFee, "Insufficient minting fee");
        require(!hashExists[fileHash], "Paper already minted");
        require(bytes(fileHash).length > 0, "File hash cannot be empty");
        require(bytes(fileName).length > 0, "File name cannot be empty");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(msg.sender, tokenId);
        
        papers[tokenId] = PaperMetadata({
            fileHash: fileHash,
            fileName: fileName,
            author: msg.sender,
            timestamp: block.timestamp,
            modelHash: ""
        });
        
        hashExists[fileHash] = true;
        hashToTokenId[fileHash] = tokenId;
        
        emit PaperMinted(tokenId, msg.sender, fileHash, fileName, block.timestamp);
        
        return tokenId;
    }
    
    function updateModelHash(uint256 tokenId, string memory modelHash) public {
        require(_ownerOf(tokenId) == msg.sender, "Only token owner can update model");
        papers[tokenId].modelHash = modelHash;
        emit ModelUpdated(tokenId, modelHash);
    }
    
    function getPaper(uint256 tokenId) public view returns (PaperMetadata memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return papers[tokenId];
    }
    
    function getPaperByHash(string memory fileHash) public view returns (PaperMetadata memory) {
        require(hashExists[fileHash], "Paper not found");
        uint256 tokenId = hashToTokenId[fileHash];
        return papers[tokenId];
    }
    
    function setMintingFee(uint256 newFee) public onlyOwner {
        mintingFee = newFee;
    }
    
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
    
    // Override functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}