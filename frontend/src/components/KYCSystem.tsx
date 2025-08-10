import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { useUser } from '../contexts/UserContext';
import { useWeb3 } from '../contexts/Web3Context';
import { kycService } from '../services/kycService';

interface KYCFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  expectedTransactionAmount: number;
  isPEP: boolean;
  isSanctioned: boolean;
}

interface KYCStatus {
  isVerified: boolean;
  kycInfo: {
    status: string;
    level: string;
    riskLevel: string;
    verificationDate: string;
    expiryDate: string;
    riskScore: string;
    dailyLimit: string;
    monthlyLimit: string;
  };
}

const steps = ['개인정보 입력', '문서 업로드', '검증 완료'];

const KYCSystem: React.FC = () => {
  const { state: userState } = useUser();
  const { web3State } = useWeb3();
  const account = web3State.account;
  const [formData, setFormData] = useState<KYCFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: 'KR',
    documentType: 'PASSPORT',
    documentNumber: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'KR',
    expectedTransactionAmount: 0,
    isPEP: false,
    isSanctioned: false
  });
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'verification' | 'complete'>('form');
  const [verificationId, setVerificationId] = useState<string>('');
  const [error, setError] = useState<string>('');

  const checkKYCStatus = useCallback(async () => {
    if (!account) return;
    
    try {
      setIsLoading(true);
      const status = await kycService.checkKYCStatus(account);
      setKycStatus(status);
      
      if (status.isVerified) {
        setCurrentStep('complete');
      }
    } catch (error) {
      console.error('KYC status check failed:', error);
      setError('KYC 상태 확인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (account) {
      checkKYCStatus();
    }
  }, [account, checkKYCStatus]);

  const handleInputChange = (e: any) => {
    const { name, value, type } = e.target;
    const checked = e.target.checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      setError('지갑을 연결해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const verification = await kycService.createVerificationSession({
        ...formData,
        userAddress: account
      });
      
      setVerificationId(verification.sessionId);
      setCurrentStep('verification');
    } catch (error) {
      console.error('KYC submission failed:', error);
      setError('KYC 제출에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkVerificationStatus = async () => {
    if (!verificationId) return;
    
    try {
      setIsLoading(true);
      const status = await kycService.checkKYCStatus(account!);
      setKycStatus(status);
      
      if (status.isVerified) {
        setCurrentStep('complete');
      }
    } catch (error) {
      console.error('Verification status check failed:', error);
      setError('검증 상태 확인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      nationality: 'KR',
      documentType: 'PASSPORT',
      documentNumber: '',
      street: '',
      city: '',
      postalCode: '',
      country: 'KR',
      expectedTransactionAmount: 0,
      isPEP: false,
      isSanctioned: false
    });
    setCurrentStep('form');
    setVerificationId('');
    setError('');
  };

  if (!web3State.isConnected) {
    return (
      <Alert severity="warning">
        KYC 검증을 위해 지갑을 연결해주세요.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 헤더 */}
      <Typography variant="h4" sx={{ fontWeight: 600 }}>
        KYC/AML 검증
      </Typography>

      {/* 스텝퍼 */}
      <Stepper activeStep={currentStep === 'form' ? 0 : currentStep === 'verification' ? 1 : 2}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* KYC 완료 상태 */}
      {currentStep === 'complete' && kycStatus && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              KYC 검증 완료
            </Typography>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  검증 상태
                </Typography>
                <Chip
                  label={kycStatus.kycInfo.status}
                  color="success"
                  sx={{ mt: 1 }}
                />
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  위험도
                </Typography>
                <Chip
                  label={kycStatus.kycInfo.riskLevel}
                  color={kycStatus.kycInfo.riskLevel === 'LOW' ? 'success' : 'warning'}
                  sx={{ mt: 1 }}
                />
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  일일 한도
                </Typography>
                <Typography variant="body1">
                  ${kycStatus.kycInfo.dailyLimit}
                </Typography>
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  월 한도
                </Typography>
                <Typography variant="body1">
                  ${kycStatus.kycInfo.monthlyLimit}
                </Typography>
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  검증일
                </Typography>
                <Typography variant="body1">
                  {new Date(kycStatus.kycInfo.verificationDate).toLocaleDateString()}
                </Typography>
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  만료일
                </Typography>
                <Typography variant="body1">
                  {new Date(kycStatus.kycInfo.expiryDate).toLocaleDateString()}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 검증 진행 중 */}
      {currentStep === 'verification' && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                KYC 검증 진행 중
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                검증 ID: {verificationId}
              </Typography>
              <Button
                variant="contained"
                onClick={checkVerificationStatus}
                disabled={isLoading}
              >
                {isLoading ? '확인 중...' : '상태 확인'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* KYC 폼 */}
      {currentStep === 'form' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              개인정보 입력
            </Typography>
            
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 기본 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  기본 정보
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="이름"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="성"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="생년월일"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      required
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <FormControl fullWidth required>
                      <InputLabel>국적</InputLabel>
                      <Select
                        name="nationality"
                        value={formData.nationality}
                        onChange={handleInputChange}
                        label="국적"
                      >
                        <MenuItem value="KR">대한민국</MenuItem>
                        <MenuItem value="US">미국</MenuItem>
                        <MenuItem value="JP">일본</MenuItem>
                        <MenuItem value="CN">중국</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>
              </Box>

              <Divider />

              {/* 문서 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  신분증 정보
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <FormControl fullWidth required>
                      <InputLabel>문서 유형</InputLabel>
                      <Select
                        name="documentType"
                        value={formData.documentType}
                        onChange={handleInputChange}
                        label="문서 유형"
                      >
                        <MenuItem value="PASSPORT">여권</MenuItem>
                        <MenuItem value="ID_CARD">주민등록증</MenuItem>
                        <MenuItem value="DRIVERS_LICENSE">운전면허증</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="문서 번호"
                      name="documentNumber"
                      value={formData.documentNumber}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                </div>
              </Box>

              <Divider />

              {/* 주소 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  주소 정보
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ width: '100%' }}>
                    <TextField
                      label="도로명 주소"
                      name="street"
                      value={formData.street}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="도시"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="우편번호"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                </div>
              </Box>

              <Divider />

              {/* AML 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  AML 정보
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="예상 거래 금액 (USD)"
                      name="expectedTransactionAmount"
                      type="number"
                      value={formData.expectedTransactionAmount}
                      onChange={handleInputChange}
                      fullWidth
                      inputProps={{ min: 0 }}
                    />
                  </div>
                  <div style={{ width: '100%' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          name="isPEP"
                          checked={formData.isPEP}
                          onChange={handleInputChange}
                        />
                      }
                      label="정치적 인물(PEP) 여부"
                    />
                  </div>
                  <div style={{ width: '100%' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          name="isSanctioned"
                          checked={formData.isSanctioned}
                          onChange={handleInputChange}
                        />
                      }
                      label="제재 대상 여부"
                    />
                  </div>
                </div>
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={isLoading}
                sx={{ mt: 2 }}
              >
                {isLoading ? '제출 중...' : 'KYC 제출'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default KYCSystem; 