import React, { useState, useEffect } from 'react';
import {
  Search,
  FilterList,
  LocationOn,
  CalendarToday,
  AttachMoney,
  TrendingUp,
  ExpandMore,
  ExpandLess,
  Clear,
  Business
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Grid,
  Pagination,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import { propertyService, PropertyData, PropertyToken } from '../services/propertyService';

interface PropertyListProps {
  showTokenizedOnly?: boolean;
}

const PropertyList: React.FC<PropertyListProps> = ({ showTokenizedOnly = false }) => {
  const [properties, setProperties] = useState<PropertyData[]>([]);
  const [tokenizedProperties, setTokenizedProperties] = useState<PropertyToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentPage, statusFilter, propertyTypeFilter, showTokenizedOnly]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (showTokenizedOnly) {
        const tokenizedData = await propertyService.getTokenizedProperties();
        setTokenizedProperties(tokenizedData);
      } else {
        const response = await propertyService.getProperties({
          page: currentPage,
          limit: 10,
          status: statusFilter || undefined,
          propertyType: propertyTypeFilter || undefined
        });
        setProperties(response.properties);
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to load properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadData();
      return;
    }

    setLoading(true);
    try {
      const searchResults = await propertyService.searchProperties(searchTerm);
      setProperties(searchResults);
      setTotalPages(1);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setPropertyTypeFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const renderPropertyCard = (property: PropertyData) => (
    <Card key={property.id} sx={{ mb: 2, '&:hover': { boxShadow: 3 } }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              {property.location}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Chip
                label={propertyService.getStatusLabel(property.status)}
                size="small"
                color={property.status === 'ACTIVE' ? 'success' : 'default'}
              />
              <Chip
                label={propertyService.getPropertyTypeLabel(property.propertyType)}
                size="small"
                color="primary"
                variant="outlined"
              />
              {property.isTokenized && (
                <Chip
                  label="토큰화됨"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            {propertyService.formatCurrency(property.totalValue)}
          </Typography>
        </Box>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {property.landArea}㎡
              </Typography>
            </Box>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {property.yearBuilt}
              </Typography>
            </Box>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                ${property.totalValue}
              </Typography>
            </Box>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {property.propertyType}
              </Typography>
            </Box>
          </div>
        </div>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            등록일: {new Date(property.createdAt).toLocaleDateString()}
          </Typography>
          <Button variant="contained" size="small">
            상세보기
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  const renderTokenizedPropertyCard = (token: PropertyToken) => (
    <Card key={token.propertyId} sx={{ mb: 2, '&:hover': { boxShadow: 3 } }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              {token.tokenSymbol}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Chip
                label={`$${token.currentPrice}`}
                size="small"
                color="primary"
              />
              <Chip
                label={`${token.totalSupply} 토큰`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            </Box>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            ${token.marketCap}
          </Typography>
        </Box>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              24시간 거래량
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              ${token.volume24h}
            </Typography>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              총 공급량
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {parseInt(token.totalSupply).toLocaleString()}
            </Typography>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              최소 투자
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              ${token.minInvestment}
            </Typography>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              배당률
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'success.main' }}>
              {token.dividendYield}%
            </Typography>
          </div>
        </div>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" size="small">
            거래하기
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 검색 및 필터 */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <TextField
              fullWidth
              placeholder="부동산 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outlined"
                startIcon={<FilterList />}
              >
                필터
              </Button>
              <Button onClick={handleSearch} variant="contained">
                검색
              </Button>
            </Box>
          </Box>

          <Collapse in={showFilters}>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <FormControl fullWidth>
                    <InputLabel>상태</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="상태"
                    >
                      <MenuItem value="">모든 상태</MenuItem>
                      <MenuItem value="ACTIVE">활성</MenuItem>
                      <MenuItem value="PENDING">대기 중</MenuItem>
                      <MenuItem value="SOLD">판매 완료</MenuItem>
                      <MenuItem value="SUSPENDED">일시 중지</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <FormControl fullWidth>
                    <InputLabel>부동산 유형</InputLabel>
                    <Select
                      value={propertyTypeFilter}
                      onChange={(e) => setPropertyTypeFilter(e.target.value)}
                      label="부동산 유형"
                    >
                      <MenuItem value="">모든 유형</MenuItem>
                      <MenuItem value="RESIDENTIAL">주거용</MenuItem>
                      <MenuItem value="COMMERCIAL">상업용</MenuItem>
                      <MenuItem value="INDUSTRIAL">산업용</MenuItem>
                      <MenuItem value="LAND">토지</MenuItem>
                      <MenuItem value="MIXED">복합용도</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <Button
                    onClick={clearFilters}
                    variant="outlined"
                    startIcon={<Clear />}
                    fullWidth
                  >
                    필터 초기화
                  </Button>
                </div>
              </div>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* 로딩 상태 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 부동산 목록 */}
      {!loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {showTokenizedOnly ? (
            tokenizedProperties.length > 0 ? (
              tokenizedProperties.map(renderTokenizedPropertyCard)
            ) : (
              <Alert severity="info" icon={<TrendingUp />}>
                토큰화된 부동산이 없습니다.
              </Alert>
            )
          ) : (
            properties.length > 0 ? (
              properties.map(renderPropertyCard)
            ) : (
              <Alert severity="info" icon={<Business />}>
                부동산이 없습니다.
              </Alert>
            )
          )}
        </Box>
      )}

      {/* 페이지네이션 */}
      {!loading && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_, page) => setCurrentPage(page)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default PropertyList; 