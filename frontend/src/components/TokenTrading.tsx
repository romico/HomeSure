import React, { useState, useEffect } from 'react';
import { Send, ShoppingCart, DollarSign, AlertCircle, CheckCircle, X } from 'lucide-react';
import Button from './common/Button';
import Modal from './common/Modal';
import { useWeb3 } from '../contexts/Web3Context';
import web3Service from '../services/web3';
import { ethers } from 'ethers';

interface TokenTradingProps {
  propertyId?: number;
  propertyTitle?: string;
  tokenPrice?: string;
  availableTokens?: string;
}

interface TransactionStatus {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
}

const TokenTrading: React.FC<TokenTradingProps> = ({
  propertyId,
  propertyTitle = '부동산 토큰',
  tokenPrice = '0.1',
  availableTokens = '1000'
}) => {
  const { web3State } = useWeb3();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null);
  const [userTokenBalance, setUserTokenBalance] = useState('0');
  const [gasEstimate, setGasEstimate] = useState<string>('0');

  // 사용자 토큰 잔액 조회
  useEffect(() => {
    if (web3State.isConnected && web3State.account) {
      loadUserTokenBalance();
    }
  }, [web3State.isConnected, web3State.account]);

  const loadUserTokenBalance = async () => {
    try {
      if (web3State.account) {
        const balance = await web3Service.getTokenBalance(web3State.account);
        setUserTokenBalance(balance);
      }
    } catch (error) {
      console.error('Failed to load token balance:', error);
    }
  };

  // 가스비 추정
  const estimateGas = async (action: 'buy' | 'sell' | 'transfer') => {
    try {
      let gasEstimate;
      switch (action) {
        case 'buy':
          gasEstimate = await web3Service.estimateGas('propertyToken', 'transfer', web3State.account, ethers.parseEther(amount));
          break;
        case 'sell':
          gasEstimate = await web3Service.estimateGas('propertyToken', 'transfer', web3State.account, ethers.parseEther(amount));
          break;
        case 'transfer':
          gasEstimate = await web3Service.estimateGas('propertyToken', 'transfer', recipient, ethers.parseEther(amount));
          break;
      }
      setGasEstimate(gasEstimate.gasLimit);
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      setGasEstimate('0');
    }
  };

  // 토큰 구매
  const handleBuyTokens = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('올바른 수량을 입력하세요.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await web3Service.transferTokens(web3State.account!, amount);
      setTransactionStatus({
        hash: result.hash,
        status: 'success',
        message: `${amount} 토큰을 성공적으로 구매했습니다.`
      });
      setShowBuyModal(false);
      setAmount('');
      loadUserTokenBalance();
    } catch (error) {
      setTransactionStatus({
        hash: '',
        status: 'failed',
        message: error instanceof Error ? error.message : '토큰 구매에 실패했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 토큰 판매
  const handleSellTokens = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('올바른 수량을 입력하세요.');
      return;
    }

    if (parseFloat(amount) > parseFloat(userTokenBalance)) {
      alert('보유한 토큰 수량보다 많은 수량을 판매할 수 없습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await web3Service.transferTokens(web3State.account!, amount);
      setTransactionStatus({
        hash: result.hash,
        status: 'success',
        message: `${amount} 토큰을 성공적으로 판매했습니다.`
      });
      setShowSellModal(false);
      setAmount('');
      loadUserTokenBalance();
    } catch (error) {
      setTransactionStatus({
        hash: '',
        status: 'failed',
        message: error instanceof Error ? error.message : '토큰 판매에 실패했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 토큰 전송
  const handleTransferTokens = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('올바른 수량을 입력하세요.');
      return;
    }

    if (!recipient || !ethers.isAddress(recipient)) {
      alert('올바른 주소를 입력하세요.');
      return;
    }

    if (parseFloat(amount) > parseFloat(userTokenBalance)) {
      alert('보유한 토큰 수량보다 많은 수량을 전송할 수 없습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await web3Service.transferTokens(recipient, amount);
      setTransactionStatus({
        hash: result.hash,
        status: 'success',
        message: `${amount} 토큰을 성공적으로 전송했습니다.`
      });
      setShowTransferModal(false);
      setAmount('');
      setRecipient('');
      loadUserTokenBalance();
    } catch (error) {
      setTransactionStatus({
        hash: '',
        status: 'failed',
        message: error instanceof Error ? error.message : '토큰 전송에 실패했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  if (!web3State.isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800">지갑을 연결하여 토큰 거래를 시작하세요.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 사용자 정보 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">내 지갑 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">지갑 주소</p>
            <p className="font-medium">{formatAddress(web3State.account!)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">ETH 잔액</p>
            <p className="font-medium">{formatBalance(web3State.balance!)} ETH</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">토큰 잔액</p>
            <p className="font-medium">{formatBalance(userTokenBalance)} 토큰</p>
          </div>
        </div>
      </div>

      {/* 거래 버튼 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          onClick={() => setShowBuyModal(true)}
          variant="primary"
          icon={ShoppingCart}
          className="w-full"
        >
          토큰 구매
        </Button>
        <Button
          onClick={() => setShowSellModal(true)}
          variant="outline"
          icon={DollarSign}
          className="w-full"
        >
          토큰 판매
        </Button>
        <Button
          onClick={() => setShowTransferModal(true)}
          variant="outline"
          icon={Send}
          className="w-full"
        >
          토큰 전송
        </Button>
      </div>

      {/* 구매 모달 */}
      <Modal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        title="토큰 구매"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">구매 정보</h4>
            <p className="text-sm text-blue-800">
              {propertyTitle} - 토큰 가격: {tokenPrice} ETH
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              구매할 토큰 수량
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">거래 정보</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>토큰 수량:</span>
                  <span>{amount} 토큰</span>
                </div>
                <div className="flex justify-between">
                  <span>총 비용:</span>
                  <span>{(parseFloat(amount) * parseFloat(tokenPrice)).toFixed(4)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span>예상 가스비:</span>
                  <span>{gasEstimate} Gwei</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleBuyTokens}
              variant="primary"
              loading={isProcessing}
              className="flex-1"
            >
              {isProcessing ? '처리 중...' : '구매하기'}
            </Button>
            <Button
              onClick={() => setShowBuyModal(false)}
              variant="outline"
              className="flex-1"
            >
              취소
            </Button>
          </div>
        </div>
      </Modal>

      {/* 판매 모달 */}
      <Modal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        title="토큰 판매"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">판매 정보</h4>
            <p className="text-sm text-green-800">
              보유 토큰: {userTokenBalance} 토큰
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              판매할 토큰 수량
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              max={userTokenBalance}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">거래 정보</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>토큰 수량:</span>
                  <span>{amount} 토큰</span>
                </div>
                <div className="flex justify-between">
                  <span>예상 수익:</span>
                  <span>{(parseFloat(amount) * parseFloat(tokenPrice)).toFixed(4)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span>예상 가스비:</span>
                  <span>{gasEstimate} Gwei</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleSellTokens}
              variant="primary"
              loading={isProcessing}
              className="flex-1"
            >
              {isProcessing ? '처리 중...' : '판매하기'}
            </Button>
            <Button
              onClick={() => setShowSellModal(false)}
              variant="outline"
              className="flex-1"
            >
              취소
            </Button>
          </div>
        </div>
      </Modal>

      {/* 전송 모달 */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="토큰 전송"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">전송 정보</h4>
            <p className="text-sm text-purple-800">
              보유 토큰: {userTokenBalance} 토큰
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              받는 사람 주소
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              전송할 토큰 수량
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              max={userTokenBalance}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">전송 정보</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>받는 사람:</span>
                  <span>{formatAddress(recipient)}</span>
                </div>
                <div className="flex justify-between">
                  <span>토큰 수량:</span>
                  <span>{amount} 토큰</span>
                </div>
                <div className="flex justify-between">
                  <span>예상 가스비:</span>
                  <span>{gasEstimate} Gwei</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleTransferTokens}
              variant="primary"
              loading={isProcessing}
              className="flex-1"
            >
              {isProcessing ? '처리 중...' : '전송하기'}
            </Button>
            <Button
              onClick={() => setShowTransferModal(false)}
              variant="outline"
              className="flex-1"
            >
              취소
            </Button>
          </div>
        </div>
      </Modal>

      {/* 거래 상태 모달 */}
      {transactionStatus && (
        <Modal
          isOpen={!!transactionStatus}
          onClose={() => setTransactionStatus(null)}
          title="거래 상태"
          size="sm"
        >
          <div className="text-center space-y-4">
            {transactionStatus.status === 'success' ? (
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            ) : (
              <X className="w-16 h-16 text-red-500 mx-auto" />
            )}
            
            <div>
              <h3 className={`text-lg font-semibold ${
                transactionStatus.status === 'success' ? 'text-green-900' : 'text-red-900'
              }`}>
                {transactionStatus.status === 'success' ? '거래 성공' : '거래 실패'}
              </h3>
              <p className="text-gray-600 mt-2">{transactionStatus.message}</p>
            </div>

            {transactionStatus.hash && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">트랜잭션 해시:</p>
                <p className="text-xs font-mono text-gray-800 break-all">
                  {transactionStatus.hash}
                </p>
              </div>
            )}

            <Button
              onClick={() => setTransactionStatus(null)}
              variant="primary"
              className="w-full"
            >
              확인
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TokenTrading; 