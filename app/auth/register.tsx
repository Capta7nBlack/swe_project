import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !name) {
      return Alert.alert("Error", "All fields are required");
    }

    setLoading(true);
    try {
      await register(email, password, name);
      // AuthContext handles the auto-login and redirect
    } catch (e: any) {
      Alert.alert("Registration Failed", "Email might already be in use.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput placeholder="Organization Name" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address"/>
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
           {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign Up</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{marginTop: 15}}>
          <Text style={styles.link}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  form: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, marginBottom: 15, borderRadius: 8, backgroundColor: '#fafafa' },
  btn: { backgroundColor: '#34C759', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#007AFF', textAlign: 'center' }
});
