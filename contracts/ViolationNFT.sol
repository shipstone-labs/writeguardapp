// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IWriteguardNFT {
    function getPaper(uint256 tokenId) external view returns (
        string memory fileHash,
        string memory fileName,
        address author,
        uint256 timestamp,
        string memory modelHash
    );
}

contract ViolationNFT is ERC721, ERC721Burnable, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    
    IWriteguardNFT public writeguardNFT;
    
    struct Violation {
        uint256 originalTokenId;
        uint256 violatingTokenId;
        string violatingSource; // URL or identifier of violating content
        uint256 similarityScore; // Similarity percentage (0-100)
        uint256 settlementAmount; // Amount required to burn the violation
        bool isSettled;
        uint256 timestamp;
    }
    
    mapping(uint256 => Violation) public violations;
    mapping(uint256 => uint256[]) public paperViolations; // originalTokenId => violationIds
    
    event ViolationCreated(
        uint256 indexed violationId,
        uint256 indexed originalTokenId,
        uint256 indexed violatingTokenId,
        uint256 similarityScore,
        uint256 settlementAmount
    );
    
    event ViolationSettled(
        uint256 indexed violationId,
        address settler,
        uint256 amount
    );

    constructor(address _writeguardNFT) ERC721("ViolationNFT", "VIOL") Ownable(msg.sender) {
        writeguardNFT = IWriteguardNFT(_writeguardNFT);
    }

    function createViolation(
        uint256 originalTokenId,
        uint256 violatingTokenId,
        string memory violatingSource,
        uint256 similarityScore,
        uint256 settlementAmount
    ) public onlyOwner returns (uint256) {
        require(similarityScore > 80, "Similarity score must be > 80%");
        require(similarityScore <= 100, "Similarity score cannot exceed 100%");
        require(settlementAmount > 0, "Settlement amount must be positive");
        
        uint256 violationId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(owner(), violationId);
        
        violations[violationId] = Violation({
            originalTokenId: originalTokenId,
            violatingTokenId: violatingTokenId,
            violatingSource: violatingSource,
            similarityScore: similarityScore,
            settlementAmount: settlementAmount,
            isSettled: false,
            timestamp: block.timestamp
        });
        
        paperViolations[originalTokenId].push(violationId);
        
        emit ViolationCreated(
            violationId,
            originalTokenId,
            violatingTokenId,
            similarityScore,
            settlementAmount
        );
        
        return violationId;
    }
    
    function settleViolation(uint256 violationId) public payable {
        require(_ownerOf(violationId) != address(0), "Violation does not exist");
        require(!violations[violationId].isSettled, "Violation already settled");
        require(msg.value >= violations[violationId].settlementAmount, "Insufficient payment");
        
        violations[violationId].isSettled = true;
        
        // Burn the violation NFT
        _burn(violationId);
        
        // Transfer settlement to original author
        (,, address originalAuthor,,) = writeguardNFT.getPaper(violations[violationId].originalTokenId);
        payable(originalAuthor).transfer(msg.value);
        
        emit ViolationSettled(violationId, msg.sender, msg.value);
    }
    
    function getViolation(uint256 violationId) public view returns (Violation memory) {
        require(_ownerOf(violationId) != address(0), "Violation does not exist");
        return violations[violationId];
    }
    
    function getPaperViolations(uint256 tokenId) public view returns (uint256[] memory) {
        return paperViolations[tokenId];
    }
    
    function getActiveViolationsCount(uint256 tokenId) public view returns (uint256) {
        uint256 count = 0;
        uint256[] memory violationIds = paperViolations[tokenId];
        
        for (uint256 i = 0; i < violationIds.length; i++) {
            if (_ownerOf(violationIds[i]) != address(0) && !violations[violationIds[i]].isSettled) {
                count++;
            }
        }
        
        return count;
    }
}