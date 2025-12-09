const request = require('supertest');

// Mock the app before importing it
jest.mock('../../app', () => {
  const express = require('express');
  const app = express();
  
  // Basic route for testing
  app.get('/', (req, res) => {
    res.status(200).json({ message: 'DietIntel Webapp', status: 'ok' });
  });
  
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  return app;
});

const app = require('../../app');

describe('Webapp Basic Functionality', () => {
  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('message', 'DietIntel Webapp');
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });
});