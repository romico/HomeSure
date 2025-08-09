const { OAuth2Client } = require('google-auth-library');

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

function getAuthUrl(state) {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['openid', 'email', 'profile'],
    state: state || undefined,
  });
  return url;
}

async function getUserFromCode(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Verify ID token to get user info
  if (!tokens.id_token) {
    throw new Error('No id_token from Google');
  }
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
    givenName: payload.given_name,
    familyName: payload.family_name,
  };
}

module.exports = { getAuthUrl, getUserFromCode };
