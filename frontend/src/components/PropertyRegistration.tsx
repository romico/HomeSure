import React, { useState } from 'react';
import {
  Business,
  LocationOn,
  AttachMoney,
  CalendarToday,
  Description,
  CloudUpload,
  CheckCircle
} from '@mui/icons-material';
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
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { propertyService, PropertyRegistrationRequest } from '../services/propertyService';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

const steps = ['부동산 정보 입력', '정보 확인', '등록 완료'];

const PropertyRegistration: React.FC = () => {
  const [formData, setFormData] = useState<PropertyRegistrationRequest>({
    location: '',
    totalValue: '',
    landArea: 0,
    buildingArea: 0,
    yearBuilt: new Date().getFullYear(),
    propertyType: 'RESIDENTIAL',
    metadata: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'landArea' || name === 'buildingArea' || name === 'yearBuilt' ? Number(value) : value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.location.trim()) {
      setError('위치를 입력해주세요.');
      return false;
    }
    if (!formData.totalValue || parseFloat(formData.totalValue) <= 0) {
      setError('유효한 총 가치를 입력해주세요.');
      return false;
    }
    if (formData.landArea <= 0) {
      setError('유효한 토지 면적을 입력해주세요.');
      return false;
    }
    if (formData.buildingArea <= 0) {
      setError('유효한 건물 면적을 입력해주세요.');
      return false;
    }
    if (formData.yearBuilt < 1900 || formData.yearBuilt > new Date().getFullYear()) {
      setError('유효한 건축년도를 입력해주세요.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setStep('review');
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const response = await propertyService.createRegistrationRequest(formData);
      setError('');
      setStep('success');
    } catch (error) {
      console.error('Registration failed:', error);
      setError('부동산 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      location: '',
      totalValue: '',
      landArea: 0,
      buildingArea: 0,
      yearBuilt: new Date().getFullYear(),
      propertyType: 'RESIDENTIAL',
      metadata: ''
    });
    setStep('form');
    setError('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 헤더 */}
      <Typography variant="h4" sx={{ fontWeight: 600 }}>
        부동산 등록
      </Typography>

      {/* 스텝퍼 */}
      <Stepper activeStep={step === 'form' ? 0 : step === 'review' ? 1 : 2}>
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

      {/* 성공 상태 */}
      {step === 'success' && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 1 }}>
                부동산 등록 완료!
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                등록 요청이 성공적으로 제출되었습니다. 검토 후 승인 여부를 알려드리겠습니다.
              </Typography>
              <Button variant="contained" onClick={resetForm}>
                새로운 등록
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 검토 상태 */}
      {step === 'review' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              등록 정보 확인
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  위치
                </Typography>
                <Typography variant="body1">
                  {formData.location}
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  총 가치
                </Typography>
                <Typography variant="body1">
                  ${parseFloat(formData.totalValue).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  토지 면적
                </Typography>
                <Typography variant="body1">
                  {formData.landArea}㎡
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  건물 면적
                </Typography>
                <Typography variant="body1">
                  {formData.buildingArea}㎡
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  건축년도
                </Typography>
                <Typography variant="body1">
                  {formData.yearBuilt}
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  부동산 유형
                </Typography>
                <Typography variant="body1">
                  {formData.propertyType === 'RESIDENTIAL' ? '주거용' :
                   formData.propertyType === 'COMMERCIAL' ? '상업용' :
                   formData.propertyType === 'INDUSTRIAL' ? '산업용' :
                   formData.propertyType === 'LAND' ? '토지' : '복합용도'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={() => setStep('form')}>
                수정
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirm}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <CloudUpload />}
              >
                {loading ? '등록 중...' : '등록 확인'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 등록 폼 */}
      {step === 'form' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              부동산 정보 입력
            </Typography>
            
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 기본 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  부동산 기본 정보
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="위치"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      required
                      fullWidth
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <FormControl fullWidth required>
                      <InputLabel>부동산 유형</InputLabel>
                      <Select
                        name="propertyType"
                        value={formData.propertyType}
                        onChange={handleInputChange}
                        label="부동산 유형"
                      >
                        <MenuItem value="RESIDENTIAL">주거용</MenuItem>
                        <MenuItem value="COMMERCIAL">상업용</MenuItem>
                        <MenuItem value="INDUSTRIAL">산업용</MenuItem>
                        <MenuItem value="LAND">토지</MenuItem>
                        <MenuItem value="MIXED">복합용도</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="총 가치 (USD)"
                      name="totalValue"
                      type="number"
                      value={formData.totalValue}
                      onChange={handleInputChange}
                      required
                      fullWidth
                      inputProps={{ min: 0, step: 1000 }}
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="토지 면적 (㎡)"
                      name="landArea"
                      type="number"
                      value={formData.landArea}
                      onChange={handleInputChange}
                      required
                      fullWidth
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </div>
                </div>
              </Box>

              <Divider />

              {/* 면적 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  면적 정보
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="건물 면적 (㎡)"
                      name="buildingArea"
                      type="number"
                      value={formData.buildingArea}
                      onChange={handleInputChange}
                      required
                      fullWidth
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <TextField
                      label="건축년도"
                      name="yearBuilt"
                      type="number"
                      value={formData.yearBuilt}
                      onChange={handleInputChange}
                      required
                      fullWidth
                      inputProps={{ min: 1900, max: new Date().getFullYear() }}
                    />
                  </div>
                </div>
              </Box>

              <Divider />

              {/* 추가 정보 */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  추가 정보
                </Typography>
                <TextField
                  label="추가 정보"
                  name="metadata"
                  value={formData.metadata}
                  onChange={handleInputChange}
                  multiline
                  rows={4}
                  fullWidth
                  placeholder="부동산에 대한 추가 설명이나 특이사항을 입력해주세요."
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? '처리 중...' : '등록 요청'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PropertyRegistration; 