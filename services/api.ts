import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS
const BASE_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:8000' 
  : 'http://localhost:8000';

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
