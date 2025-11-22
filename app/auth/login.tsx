import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Error", "Please enter email and password");

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (e) {
      Alert.alert("Login Failed", "Check your credentials and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>SCP Consumer</Text>
        
        <Text style={styles.label}>Email</Text>
        <TextInput 
          placeholder="supplier@test.com" 
          value={email} 
          onChangeText={setEmail} 
          style={styles.input} 
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <Text style={styles.label}>Password</Text>
        <TextInput 
          placeholder="********" 
          value={password} 
          onChangeText={setPassword} 
          style={styles.input} 
          secureTextEntry 
        />
        
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Login</Text>
          )}
        </TouchableOpacity>

        <Link href="/auth/register" asChild>
          <TouchableOpacity style={{marginTop: 20}}>
            <Text style={styles.link}>Create New Account</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  form: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, marginBottom: 15, borderRadius: 8, backgroundColor: '#fafafa' },
  btn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#007AFF', fontWeight: 'bold', textAlign: 'center' }
});
