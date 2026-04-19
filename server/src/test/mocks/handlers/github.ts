import { http, HttpResponse } from 'msw';

export const TEST_GITHUB_USER = {
  id: 99999999,
  login: 'test-github-user',
  email: 'testuser@github.com',
  name: 'Test GitHub User',
  avatar_url: 'https://avatars.githubusercontent.com/u/99999999',
};

export const githubHandlers = [
  // OAuth token exchange
  http.post('https://github.com/login/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: 'mock-github-access-token',
      token_type: 'bearer',
      scope: 'read:user,user:email',
    });
  }),

  // User profile
  http.get('https://api.github.com/user', () => {
    return HttpResponse.json({
      id: TEST_GITHUB_USER.id,
      login: TEST_GITHUB_USER.login,
      name: TEST_GITHUB_USER.name,
      email: TEST_GITHUB_USER.email,
      avatar_url: TEST_GITHUB_USER.avatar_url,
    });
  }),

  // User emails (used when email is private)
  http.get('https://api.github.com/user/emails', () => {
    return HttpResponse.json([
      { email: TEST_GITHUB_USER.email, primary: true, verified: true },
    ]);
  }),

  // User repos (fetched for profile enrichment)
  http.get('https://api.github.com/user/repos', () => {
    return HttpResponse.json([
      { id: 1, name: 'test-repo', full_name: `${TEST_GITHUB_USER.login}/test-repo`, private: false },
    ]);
  }),
];
