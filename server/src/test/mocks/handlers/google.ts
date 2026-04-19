import { http, HttpResponse } from 'msw';

export const TEST_GOOGLE_USER = {
  id: 'google-test-user-123',
  email: 'testuser@gmail.com',
  name: 'Test User',
  picture: 'https://example.com/photo.jpg',
};

// The actual token URL used by passport-google-oauth20.
export const GOOGLE_TOKEN_URL = 'https://www.googleapis.com/oauth2/v4/token';

export const googleHandlers = [
  // OAuth token exchange — passport-google-oauth20 posts to /oauth2/v4/token
  http.post(GOOGLE_TOKEN_URL, () => {
    return HttpResponse.json({
      access_token: 'mock-google-access-token',
      refresh_token: 'mock-google-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile',
    });
  }),

  // Userinfo endpoint
  http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
    return HttpResponse.json({
      id: TEST_GOOGLE_USER.id,
      email: TEST_GOOGLE_USER.email,
      verified_email: true,
      name: TEST_GOOGLE_USER.name,
      given_name: 'Test',
      family_name: 'User',
      picture: TEST_GOOGLE_USER.picture,
    });
  }),

  // Google OAuth v3 userinfo
  http.get('https://www.googleapis.com/oauth2/v3/userinfo', () => {
    return HttpResponse.json({
      sub: TEST_GOOGLE_USER.id,
      email: TEST_GOOGLE_USER.email,
      email_verified: true,
      name: TEST_GOOGLE_USER.name,
      picture: TEST_GOOGLE_USER.picture,
    });
  }),
];
