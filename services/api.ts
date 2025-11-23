import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Your specific IP address
// The base URL is linked to the ngrok given link that listens to the port 8000. 
// So each time the ngrok is restarted, this link has to be changed as well
const BASE_URL = '';

const api = axios.create({
  baseURL: BASE_URL,
});

// Automatically add the Token to every request if it exists
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
