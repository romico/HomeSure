import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Schedule,
  AttachMoney,
  Warning,
  CheckCircle,
  Close,
  Add,
  Remove
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Grid
} from '@mui/material';
import { useWeb3 } from '../contexts/Web3Context';
import { useUser } from '../contexts/UserContext';
import tradingService from '../services/tradingService';

interface Order {
  orderId: number;
  propertyId: number;
  trader: string;
  orderType: 'BUY' | 'SELL';
  price: string;
  quantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  expiryTime: string;
  status: 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string;
}

interface Trade {
  tradeId: number;
  buyOrderId: number;
  sellOrderId: number;
  propertyId: number;
  buyer: string;
  seller: string;
  price: string;
  quantity: string;
  totalAmount: string;
  platformFee: string;
  executedAt: string;
}

interface OrderBook {
  buyOrders: Order[];
  sellOrders: Order[];
}

const TradingSystem: React.FC = () => {
  const { web3State } = useWeb3();
  const { state: userState } = useUser();
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedProperty, setSelectedProperty] = useState<number>(1);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook>({ buyOrders: [], sellOrders: [] });
  const [activeTab, setActiveTab] = useState<'orderbook' | 'orders' | 'trades'>('orderbook');

  useEffect(() => {
    if (web3State.isConnected) {
      loadOrders();
      loadTrades();
      loadOrderBook();
    }
  }, [web3State.isConnected, selectedProperty]);

  const loadOrders = async () => {
    try {
      const response = await tradingService.getOrders({ propertyId: selectedProperty });
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadTrades = async () => {
    try {
      const response = await tradingService.getTrades({ propertyId: selectedProperty });
      setTrades(response.data.trades);
    } catch (error) {
      console.error('Failed to load trades:', error);
    }
  };

  const loadOrderBook = async () => {
    try {
      const response = await tradingService.getOrderBook(selectedProperty);
      setOrderBook(response.data);
    } catch (error) {
      console.error('Failed to load order book:', error);
    }
  };

  const handleCreateOrder = async () => {
    if (!price || !quantity || !expiryTime) {
      alert('모든 필드를 입력하세요.');
      return;
    }

    if (!window.confirm('주문을 생성하시겠습니까?')) {
      return;
    }

    setIsProcessing(true);
    try {
      await tradingService.createOrder({
        propertyId: selectedProperty,
        orderType: orderType === 'BUY' ? 0 : 1,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        expiryTime: new Date(expiryTime).getTime()
      });

      setShowOrderModal(false);
      setPrice('');
      setQuantity('');
      setExpiryTime('');
      loadOrders();
      loadOrderBook();
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('주문 생성에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      await tradingService.cancelOrder(orderId);
      loadOrders();
      loadOrderBook();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert('주문 취소에 실패했습니다.');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(4);
  };

  const formatQuantity = (quantity: string) => {
    return parseFloat(quantity).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'primary';
      case 'PARTIAL': return 'warning';
      case 'FILLED': return 'success';
      case 'CANCELLED': return 'error';
      case 'EXPIRED': return 'default';
      default: return 'default';
    }
  };

  if (!web3State.isConnected) {
    return (
      <Alert severity="warning" icon={<Warning />}>
        지갑을 연결해주세요.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          거래 시스템
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setShowOrderModal(true)}
        >
          새 주문
        </Button>
      </Box>

      {/* 탭 네비게이션 */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="오더북" value="orderbook" />
          <Tab label="내 주문" value="orders" />
          <Tab label="거래 내역" value="trades" />
        </Tabs>
      </Paper>

      {/* 오더북 탭 */}
      {activeTab === 'orderbook' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              오더북 - 부동산 #{selectedProperty}
            </Typography>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {/* 매수 주문 */}
              <div style={{ flex: '1 1 400px', minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ color: 'success.main', mb: 1 }}>
                  매수 주문
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>가격</TableCell>
                        <TableCell>수량</TableCell>
                        <TableCell>총액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orderBook.buyOrders.slice(0, 10).map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell sx={{ color: 'success.main' }}>
                            {formatPrice(order.price)} ETH
                          </TableCell>
                          <TableCell>{formatQuantity(order.remainingQuantity)}</TableCell>
                          <TableCell>
                            {formatPrice((parseFloat(order.price) * parseFloat(order.remainingQuantity)).toString())} ETH
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>

              {/* 매도 주문 */}
              <div style={{ flex: '1 1 400px', minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ color: 'error.main', mb: 1 }}>
                  매도 주문
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>가격</TableCell>
                        <TableCell>수량</TableCell>
                        <TableCell>총액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orderBook.sellOrders.slice(0, 10).map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell sx={{ color: 'error.main' }}>
                            {formatPrice(order.price)} ETH
                          </TableCell>
                          <TableCell>{formatQuantity(order.remainingQuantity)}</TableCell>
                          <TableCell>
                            {formatPrice((parseFloat(order.price) * parseFloat(order.remainingQuantity)).toString())} ETH
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 내 주문 탭 */}
      {activeTab === 'orders' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              내 주문
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>주문 ID</TableCell>
                    <TableCell>타입</TableCell>
                    <TableCell>가격</TableCell>
                    <TableCell>수량</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>만료시간</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell>#{order.orderId}</TableCell>
                      <TableCell>
                        <Chip
                          label={order.orderType === 'BUY' ? '매수' : '매도'}
                          color={order.orderType === 'BUY' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatPrice(order.price)} ETH</TableCell>
                      <TableCell>{formatQuantity(order.remainingQuantity)}</TableCell>
                      <TableCell>
                        <Chip
                          label={order.status}
                          color={getStatusColor(order.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(order.expiryTime)}</TableCell>
                      <TableCell>
                        {order.status === 'OPEN' && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelOrder(order.orderId)}
                          >
                            <Close />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {orders.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                주문 내역이 없습니다.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 거래 내역 탭 */}
      {activeTab === 'trades' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              거래 내역
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>거래 ID</TableCell>
                    <TableCell>가격</TableCell>
                    <TableCell>수량</TableCell>
                    <TableCell>총액</TableCell>
                    <TableCell>수수료</TableCell>
                    <TableCell>시간</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.tradeId}>
                      <TableCell>#{trade.tradeId}</TableCell>
                      <TableCell>{formatPrice(trade.price)} ETH</TableCell>
                      <TableCell>{formatQuantity(trade.quantity)}</TableCell>
                      <TableCell>{formatPrice(trade.totalAmount)} ETH</TableCell>
                      <TableCell>{formatPrice(trade.platformFee)} ETH</TableCell>
                      <TableCell>{formatDate(trade.executedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {trades.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                거래 내역이 없습니다.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 주문 생성 모달 */}
      <Dialog
        open={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>새 주문 생성</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* 주문 타입 선택 */}
            <FormControl component="fieldset">
              <FormLabel component="legend">주문 타입</FormLabel>
              <RadioGroup
                row
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'BUY' | 'SELL')}
              >
                <FormControlLabel
                  value="BUY"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUp sx={{ color: 'success.main' }} />
                      <Typography sx={{ color: 'success.main', fontWeight: 500 }}>
                        매수
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="SELL"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingDown sx={{ color: 'error.main' }} />
                      <Typography sx={{ color: 'error.main', fontWeight: 500 }}>
                        매도
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            {/* 가격 */}
            <TextField
              label="가격 (ETH)"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.0"
              inputProps={{ step: 0.0001, min: 0 }}
              fullWidth
            />

            {/* 수량 */}
            <TextField
              label="수량 (토큰)"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              inputProps={{ step: 0.01, min: 0 }}
              fullWidth
            />

            {/* 만료 시간 */}
            <TextField
              label="만료 시간"
              type="datetime-local"
              value={expiryTime}
              onChange={(e) => setExpiryTime(e.target.value)}
              inputProps={{ min: new Date().toISOString().slice(0, 16) }}
              fullWidth
            />

            {/* 총액 계산 */}
            {price && quantity && (
              <Alert severity="info">
                총액: {formatPrice((parseFloat(price) * parseFloat(quantity)).toString())} ETH
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOrderModal(false)}>
            취소
          </Button>
          <Button
            onClick={handleCreateOrder}
            variant="contained"
            disabled={isProcessing || !price || !quantity || !expiryTime}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <Add />}
          >
            {isProcessing ? '처리 중...' : '주문 생성'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TradingSystem; 