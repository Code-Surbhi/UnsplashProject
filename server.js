require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); //npm install node-fetch@2
const cors = require('cors');
const { URLSearchParams } = require('url'); 
const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.post('/callback', async (req, res) => {
  const { code } = req.body; 

  console.log('Backend received code:', code); 

  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');

    const response = await fetch('https://unsplash.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params    
    });

    const data = await response.json();
    console.log("Response from Unsplash:", data);

    if (response.ok && data.access_token) {
      res.json({ accessToken: data.access_token }); 
    } else {
      console.error('Unsplash token error:', data);
      res.status(response.status || 400).json({ error: 'Token exchange failed', details: data });
    }
  } catch (err) {
    console.error('Fetch failed or server error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

app.get('/search', async (req, res) => {
  const { query, page } = req.query;
  const accessToken = req.headers.authorization; 

  console.log(`Backend received search request - Query: "${query}", Page: ${page}`);
  console.log('Backend received accessToken for search:', accessToken ? 'Present' : 'Missing');

  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }
  if (!accessToken) {
      return res.status(401).json({ error: 'Authorization token missing.' });
  }

  try {
    const unsplashSearchUrl = new URL('https://api.unsplash.com/search/photos');
    unsplashSearchUrl.searchParams.append('query', query);
    unsplashSearchUrl.searchParams.append('page', page || '1'); 
    unsplashSearchUrl.searchParams.append('per_page', '15'); 

    const response = await fetch(unsplashSearchUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': accessToken, 
      }
    });

    const data = await response.json();
    console.log("Response from Unsplash (search):", data); 

    if (response.ok) {
      res.json(data); 
    } else {
      console.error('Unsplash search error:', data);
      res.status(response.status || 400).json({ error: 'Unsplash search failed', details: data });
    }

  } catch (err) {
    console.error('Fetch failed or server error during search:', err);
    res.status(500).json({ error: 'Server error during search', message: err.message });
  }
});


app.listen(3000, () => console.log('Server running at http://localhost:3000'));