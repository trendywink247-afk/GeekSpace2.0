// ============================================================
// Deployment Service — Deploy to Netlify & Vercel
// ============================================================

export interface DeployPayload {
  name: string;
  html: string;
  css: string;
  js: string;
}

export interface DeployResult {
  id: string;
  url: string;
}

/**
 * Deploy files to Netlify
 */
export async function deployToNetlify(token: string, payload: DeployPayload): Promise<DeployResult> {
  // First, create a new site
  const siteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    }),
  });

  if (!siteResponse.ok) {
    const error = await siteResponse.text();
    throw new Error(`Netlify site creation failed: ${error}`);
  }

  const site = await siteResponse.json() as { id: string; url: string };

  // Deploy the files
  const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        '/index.html': payload.html,
        '/style.css': payload.css,
        '/script.js': payload.js,
      },
    }),
  });

  if (!deployResponse.ok) {
    const error = await deployResponse.text();
    throw new Error(`Netlify deploy failed: ${error}`);
  }

  const deploy = await deployResponse.json() as { id: string };

  return {
    id: deploy.id,
    url: site.url,
  };
}

/**
 * Deploy files to Vercel
 */
export async function deployToVercel(token: string, payload: DeployPayload): Promise<DeployResult> {
  // Create deployment
  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      files: [
        { file: 'index.html', data: payload.html, encoding: 'utf-8' },
        { file: 'style.css', data: payload.css, encoding: 'utf-8' },
        { file: 'script.js', data: payload.js, encoding: 'utf-8' },
      ],
      projectSettings: {
        framework: null,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel deploy failed: ${error}`);
  }

  const result = await response.json() as { id: string; url: string };

  return {
    id: result.id,
    url: `https://${result.url}`,
  };
}
