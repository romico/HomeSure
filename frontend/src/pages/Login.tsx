import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Stack, Alert, Divider } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Handle OAuth hash fragment tokens (e.g., /login#accessToken=...&refreshToken=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (accessToken || refreshToken) {
      // Clean hash from URL
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      const redirectTo = location.state?.from || '/portfolio';
      navigate(redirectTo, { replace: true });
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.login(email, password);
      const redirectTo = location.state?.from || '/portfolio';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <Card sx={{ width: 380 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>로그인</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <TextField label="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <TextField label="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </Stack>
          <Divider sx={{ my: 2 }}>또는</Divider>
          <Button fullWidth variant="outlined" color="inherit" onClick={() => window.location.href = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api') + '/auth/google'}>
            Google로 계속하기
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;


