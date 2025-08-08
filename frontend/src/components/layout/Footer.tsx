import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Divider
} from '@mui/material';
import {
  GitHub,
  Twitter,
  LinkedIn,
  Email
} from '@mui/icons-material';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const navigation = {
    main: [
      { name: '홈', href: '#home' },
      { name: '부동산', href: '#properties' },
      { name: '거래', href: '#trading' },
      { name: '포트폴리오', href: '#portfolio' },
      { name: '설정', href: '#settings' },
    ],
    support: [
      { name: '도움말', href: '#help' },
      { name: '문의하기', href: '#contact' },
      { name: 'FAQ', href: '#faq' },
    ],
    legal: [
      { name: '이용약관', href: '#terms' },
      { name: '개인정보처리방침', href: '#privacy' },
      { name: '서비스 정책', href: '#policy' },
    ],
  };

  const social = [
    {
      name: 'GitHub',
      href: 'https://github.com/homesure',
      icon: GitHub,
    },
    {
      name: 'Twitter',
      href: 'https://twitter.com/homesure',
      icon: Twitter,
    },
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com/company/homesure',
      icon: LinkedIn,
    },
    {
      name: 'Email',
      href: 'mailto:contact@homesure.com',
      icon: Email,
    },
  ];

  const handleNavigation = (href: string) => {
    // 실제 라우팅 대신 탭 변경을 위해 이벤트 발생
    const event = new CustomEvent('tabChange', { detail: { tab: href.replace('#', '') } });
    window.dispatchEvent(event);
  };

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'grey.900',
        color: 'white',
        py: { xs: 4, sm: 6 },
        mt: 'auto'
      }}
    >
      <Container maxWidth="xl">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          {/* Brand */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white' }}>
                  H
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                HomeSure
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'grey.400', lineHeight: 1.6 }}>
            </Typography>
          </div>

          {/* Main Navigation */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'grey.300',
                textTransform: 'uppercase',
                letterSpacing: 1,
                mb: 2
              }}
            >
              서비스
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {navigation.main.map((item) => (
                <Button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  sx={{
                    color: 'grey.400',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      color: 'white',
                      bgcolor: 'transparent'
                    }
                  }}
                >
                  {item.name}
                </Button>
              ))}
            </Box>
          </div>

          {/* Support */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'grey.300',
                textTransform: 'uppercase',
                letterSpacing: 1,
                mb: 2
              }}
            >
              지원
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {navigation.support.map((item) => (
                <Button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  sx={{
                    color: 'grey.400',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      color: 'white',
                      bgcolor: 'transparent'
                    }
                  }}
                >
                  {item.name}
                </Button>
              ))}
            </Box>
          </div>

          {/* Legal */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'grey.300',
                textTransform: 'uppercase',
                letterSpacing: 1,
                mb: 2
              }}
            >
              법적 고지
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {navigation.legal.map((item) => (
                <Button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  sx={{
                    color: 'grey.400',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      color: 'white',
                      bgcolor: 'transparent'
                    }
                  }}
                >
                  {item.name}
                </Button>
              ))}
            </Box>
          </div>
        </div>

        {/* Bottom Section */}
        <Divider sx={{ borderColor: 'grey.800', mb: 3 }} />
        
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography variant="body2" sx={{ color: 'grey.400', textAlign: { xs: 'center', sm: 'left' } }}>
            © {currentYear} HomeSure. All rights reserved.
          </Typography>
          
          {/* Social Links */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            {social.map((item) => (
              <IconButton
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'grey.400',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'grey.800'
                  }
                }}
                aria-label={item.name}
              >
                <item.icon sx={{ fontSize: 20 }} />
              </IconButton>
            ))}
          </Box>
        </Box>

        {/* Additional Info */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'grey.500',
              lineHeight: 1.6,
              maxWidth: 600,
              mx: 'auto',
              display: 'block'
            }}
          >
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer; 