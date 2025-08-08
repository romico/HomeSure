// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IERC1400
 * @dev ERC-1400 표준 인터페이스
 * 부동산 토큰화를 위한 확장된 ERC-20 표준
 */
interface IERC1400 {
    // ERC-1400 확장 함수들
    function issueTokens(address to, uint256 amount, bytes calldata data) external returns (bool);
    function redeemTokens(uint256 amount, bytes calldata data) external returns (bool);
    function transferWithData(address to, uint256 amount, bytes calldata data) external returns (bool);
    function transferFromWithData(address from, address to, uint256 amount, bytes calldata data) external returns (bool);
    
    // 파티션 관련 함수들
    function balanceOfByPartition(bytes32 partition, address tokenHolder) external view returns (uint256);
    function partitionsOf(address tokenHolder) external view returns (bytes32[] memory);
    function transferByPartition(bytes32 partition, address to, uint256 amount, bytes calldata data) external returns (bytes32);
    function operatorTransferByPartition(bytes32 partition, address from, address to, uint256 amount, bytes calldata data, bytes calldata operatorData) external returns (bytes32);
    
    // 권한 관련 함수들
    function isIssuer(address operator) external view returns (bool);
    function isOperator(address operator) external view returns (bool);
    function authorizeOperator(address operator) external;
    function revokeOperator(address operator) external;
    function authorizeOperatorByPartition(bytes32 partition, address operator) external;
    function revokeOperatorByPartition(bytes32 partition, address operator) external;
    
    // 제한 관련 함수들
    function isTransferable(bytes32 partition, address to, uint256 amount, bytes calldata data) external view returns (bool);
    function canTransfer(bytes32 partition, address to, uint256 amount, bytes calldata data) external view returns (bool, bytes32, bytes32);
    
    // 이벤트들
    event Issued(address indexed operator, address indexed to, uint256 amount, bytes data);
    event Redeemed(address indexed operator, address indexed from, uint256 amount, bytes data);
    event TransferByPartition(bytes32 indexed fromPartition, address indexed operator, address indexed from, address to, uint256 amount, bytes data, bytes operatorData);
    event AuthorizedOperator(address indexed operator, address indexed tokenHolder);
    event RevokedOperator(address indexed operator, address indexed tokenHolder);
    event AuthorizedOperatorByPartition(bytes32 indexed partition, address indexed operator, address indexed tokenHolder);
    event RevokedOperatorByPartition(bytes32 indexed partition, address indexed operator, address indexed tokenHolder);
} 