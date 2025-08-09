import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Stack } from '@mui/material';

async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  return res.json();
}

export default function DbTestPage() {
  const [result, setResult] = useState<any>(null);

  const check = async () => {
    const data = await call('/api/dbtest');
    setResult(data);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        DB 테스트 도구
      </Typography>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={check}>
              상태 확인 / 샘플 조회
            </Button>
          </Stack>
          <Box mt={2}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}


